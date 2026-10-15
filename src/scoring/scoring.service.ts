import { Injectable } from '@nestjs/common';
import type { Activity } from './entities/activity.js';
import { ActivityCatalogue } from './entities/activity-scorers.js';
import type {
  ActivityOutcome,
  DataSource,
  DayConditions,
  HourlyMarine,
  HourlyWeather,
  MarineDayFeatures,
  WeatherDayFeatures,
} from './entities/day-features.js';
import { ScoreScale, type RatedScore } from './entities/score-scale.js';
import { DailyFeaturesMapper } from './mappers/daily-features.mapper.js';
import { FeatureValuesMapper } from './mappers/feature-values.mapper.js';

/** Everything the rest of the application needs to know about how good a day is for an activity. */
@Injectable()
export class ScoringService {
  constructor(
    private readonly activityCatalogue: ActivityCatalogue,
    private readonly scoreScale: ScoreScale,
    private readonly dailyFeaturesMapper: DailyFeaturesMapper,
    private readonly featureValuesMapper: FeatureValuesMapper,
  ) {}

  requiredSources(activities: readonly Activity[]): DataSource[] {
    return this.activityCatalogue.requiredSourcesOf(activities);
  }

  summariseWeatherDays(hours: readonly HourlyWeather[], timeZone: string): Map<string, WeatherDayFeatures> {
    return this.dailyFeaturesMapper.toWeatherDays(hours, timeZone);
  }

  summariseMarineDays(hours: readonly HourlyMarine[], timeZone: string): Map<string, MarineDayFeatures> {
    return this.dailyFeaturesMapper.toMarineDays(hours, timeZone);
  }

  score(activities: readonly Activity[], day: DayConditions): ActivityOutcome[] {
    const features = this.featureValuesMapper.toFeatureValues(day);
    return activities.map((activity) => ({
      activity,
      outcome: this.activityCatalogue.scorerFor(activity).score(features),
    }));
  }

  rate(score: number): RatedScore {
    return this.scoreScale.rate(score);
  }
}
