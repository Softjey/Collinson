import { Injectable } from '@nestjs/common';
import type { Activity } from '../scoring/entities/activity.js';
import type {
  DataSource,
  DayConditions,
  MarineDayFeatures,
  WeatherDayFeatures,
} from '../scoring/entities/day-features.js';
import { LocationService } from '../location/location.service.js';
import { ScoringService } from '../scoring/scoring.service.js';
import { Metrics } from '../shared/observability/metrics.js';
import { datesBetween, type LocalDate } from '../shared/local-date.js';
import type {
  ForecastData,
  LocationRef,
  MarineData,
  SourceResult,
} from '../weather/entities/weather.types.js';
import { WeatherService } from '../weather/weather.service.js';
import type { ActivityScoresInput } from './entities/activity-scores.input.js';
import type { ActivityScores, ActivityScoresResult, DayResult } from './entities/activity-scores.result.js';
import { HourlyDataMapper } from './mappers/hourly-data.mapper.js';
import { ResultMapper } from './mappers/result.mapper.js';
import { TimeZoneService } from './time-zone.service.js';
import { SourceResultCombiner } from './utils/source-result-combiner.js';

interface LoadedSources {
  forecast: SourceResult<ForecastData> | null;
  marine: SourceResult<MarineData> | null;
}

const RESULT_STATUS_BY_TYPE = {
  ActivityDayScores: 'scored',
  ActivityDataTooOld: 'too_old',
  ActivityDataUnavailable: 'unavailable',
} as const satisfies Record<ActivityScoresResult['__typename'], string>;

type OkSourceResult = Extract<SourceResult<unknown>, { status: 'ok' }>;

@Injectable()
export class ActivityScoresService {
  constructor(
    private readonly locationService: LocationService,
    private readonly weatherService: WeatherService,
    private readonly scoringService: ScoringService,
    private readonly timeZoneService: TimeZoneService,
    private readonly sourceResultCombiner: SourceResultCombiner,
    private readonly hourlyDataMapper: HourlyDataMapper,
    private readonly resultMapper: ResultMapper,
    private readonly metrics: Metrics,
  ) {}

  async scoreActivities(input: ActivityScoresInput): Promise<ActivityScores> {
    const { latitude, longitude } = input;
    const timeZone = this.timeZoneService.timeZoneOf(latitude, longitude);

    const location = await this.locationService.findOrCreate(latitude, longitude, timeZone);
    const loadedSources = await this.loadSources(input, location);
    const daysByActivity = this.scoreDays(input, loadedSources, location.timezone);

    const activities = input.activities.map((activity) =>
      this.resultFor(activity, loadedSources, daysByActivity.get(activity) ?? []),
    );
    activities.forEach((result) => this.recordMetrics(result));

    return {
      location: this.resultMapper.toLocation(
        { latitude, longitude, timezone: location.timezone },
        await this.locationService.getElevation(location),
      ),
      activities,
    };
  }

  private recordMetrics(result: ActivityScoresResult): void {
    const { activity } = result;
    this.metrics.increment('activityResult', { activity, status: RESULT_STATUS_BY_TYPE[result.__typename] });
    if (result.__typename !== 'ActivityDayScores') {
      return;
    }
    for (const day of result.days) {
      if (day.__typename === 'UnscoredDay') {
        this.metrics.increment('unscoredDay', { activity, reason: day.reason });
      }
    }
  }

  private async loadSources(input: ActivityScoresInput, location: LocationRef): Promise<LoadedSources> {
    const requiredSources = this.scoringService.requiredSources(input.activities);

    const [forecast, marine] = await Promise.all([
      requiredSources.includes('WEATHER') ? this.weatherService.getForecast(location, input.toDate) : null,
      requiredSources.includes('WAVES') ? this.weatherService.getMarine(location, input.toDate) : null,
    ]);

    return { forecast, marine };
  }

  private scoreDays(
    input: ActivityScoresInput,
    loadedSources: LoadedSources,
    timeZone: string,
  ): Map<Activity, DayResult[]> {
    const usableActivities = input.activities.filter(
      (activity) => this.statusOf(activity, loadedSources).status === 'ok',
    );
    const daysByActivity = new Map<Activity, DayResult[]>();

    for (const { date, conditions } of this.dayConditions(input, loadedSources, timeZone)) {
      for (const { activity, outcome } of this.scoringService.score(usableActivities, conditions)) {
        const days = daysByActivity.get(activity) ?? [];
        days.push(this.resultMapper.toDayResult(date, outcome));
        daysByActivity.set(activity, days);
      }
    }

    return daysByActivity;
  }

  private dayConditions(
    input: ActivityScoresInput,
    loadedSources: LoadedSources,
    timeZone: string,
  ): { date: LocalDate; conditions: DayConditions }[] {
    const weatherDays = this.weatherDaysOf(loadedSources.forecast, timeZone);
    const sea = this.seaOf(loadedSources.marine, timeZone);

    return datesBetween(input.fromDate, input.toDate).map((date) => ({
      date,
      conditions: {
        weather: weatherDays.get(date) ?? null,
        marine: sea && { hasSea: sea.hasSea, features: sea.days.get(date) ?? null },
      },
    }));
  }

  private weatherDaysOf(
    forecast: SourceResult<ForecastData> | null,
    timeZone: string,
  ): Map<LocalDate, WeatherDayFeatures> {
    if (forecast?.status !== 'ok') {
      return new Map();
    }
    const hours = this.hourlyDataMapper.toHourlyWeather(forecast.data.hours);
    return this.scoringService.summariseWeatherDays(hours, timeZone);
  }

  private seaOf(
    marine: SourceResult<MarineData> | null,
    timeZone: string,
  ): { hasSea: boolean; days: Map<LocalDate, MarineDayFeatures> } | null {
    if (marine?.status !== 'ok') {
      return null;
    }
    const hours = this.hourlyDataMapper.toHourlyMarine(marine.data.hours);
    return { hasSea: marine.data.hasSea, days: this.scoringService.summariseMarineDays(hours, timeZone) };
  }

  private resultFor(
    activity: Activity,
    loadedSources: LoadedSources,
    days: DayResult[],
  ): ActivityScoresResult {
    const status = this.statusOf(activity, loadedSources);
    if (status.status === 'unavailable') {
      return this.resultMapper.toDataUnavailable(activity, status.cause);
    }
    if (status.status === 'too_old') {
      return this.resultMapper.toDataTooOld(activity, status.lastUpdatedAt);
    }
    return this.resultMapper.toActivityDayScores(activity, days, this.freshnessOf(activity, loadedSources));
  }

  private statusOf(activity: Activity, loadedSources: LoadedSources) {
    return this.sourceResultCombiner.combine(
      this.requiredResultsOf(activity, loadedSources).map(({ result }) => result),
    );
  }

  private freshnessOf(activity: Activity, loadedSources: LoadedSources) {
    return this.requiredResultsOf(activity, loadedSources).map(({ kind, result }) =>
      this.resultMapper.toFreshness(kind, result as OkSourceResult),
    );
  }

  private requiredResultsOf(activity: Activity, { forecast, marine }: LoadedSources) {
    const resultsBySource: Record<DataSource, SourceResult<unknown> | null> = {
      WEATHER: forecast,
      WAVES: marine,
    };
    return this.scoringService.requiredSources([activity]).map((kind) => ({
      kind,
      result: resultsBySource[kind] as SourceResult<unknown>,
    }));
  }
}
