import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../shared/clock.js';
import { APP_CONFIG } from '../shared/config/config.module.js';
import type { AppConfig } from '../shared/config/env.schema.js';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../shared/open-meteo/open-meteo.errors.js';
import type { ForecastResponse } from '../shared/open-meteo/schemas/forecast.schema.js';
import type { MarineResponse } from '../shared/open-meteo/schemas/marine.schema.js';
import { SingleFlight } from '../shared/single-flight.js';
import type {
  ForecastData,
  LocalDate,
  LocationRef,
  MarineData,
  SourceFailureCause,
  SourceResult,
  StoredSnapshot,
} from './entities/weather.types.js';
import { ForecastClient } from './forecast.client.js';
import { ForecastMapper } from './mappers/forecast.mapper.js';
import { MarineMapper } from './mappers/marine.mapper.js';
import { MarineClient } from './marine.client.js';
import { ForecastRepository, type ForecastSnapshotRow } from './repositories/forecast.repository.js';
import { MarineRepository, type MarineSnapshotRow } from './repositories/marine.repository.js';
import { decideAfterFailure, isReusable } from './utils/freshness.policy.js';

interface SnapshotRepository<WeatherData, SnapshotRow> {
  findLatest(locationId: number): Promise<SnapshotRow | null>;
  insert(locationId: number, data: WeatherData, fetchedAt: Date): Promise<{ id: number }>;
}

interface WeatherSource<WeatherData, ApiResponse, SnapshotRow> {
  name: 'forecast' | 'marine';
  refreshIntervalHours: number;
  snapshotRepository: SnapshotRepository<WeatherData, SnapshotRow>;
  client: { fetch(location: LocationRef): Promise<ApiResponse> };
  mapper: {
    toData(apiResponse: ApiResponse): WeatherData;
    toStored(snapshotRow: SnapshotRow): StoredSnapshot<WeatherData>;
  };
  mustCoverRequestedDates(data: WeatherData): boolean;
}

type WeatherSettings = Pick<AppConfig, 'weatherRefreshHours' | 'wavesRefreshHours' | 'maxStaleHours'>;

@Injectable()
export class WeatherService {
  private readonly singleFlight = new SingleFlight();
  private readonly forecastSource: WeatherSource<ForecastData, ForecastResponse, ForecastSnapshotRow>;
  private readonly marineSource: WeatherSource<MarineData, MarineResponse, MarineSnapshotRow>;

  constructor(
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly weatherSettings: WeatherSettings,
    forecastClient: ForecastClient,
    marineClient: MarineClient,
    forecastRepository: ForecastRepository,
    marineRepository: MarineRepository,
    forecastMapper: ForecastMapper,
    marineMapper: MarineMapper,
  ) {
    this.forecastSource = {
      name: 'forecast',
      refreshIntervalHours: weatherSettings.weatherRefreshHours,
      snapshotRepository: forecastRepository,
      client: forecastClient,
      mapper: forecastMapper,
      mustCoverRequestedDates: () => true,
    };
    this.marineSource = {
      name: 'marine',
      refreshIntervalHours: weatherSettings.wavesRefreshHours,
      snapshotRepository: marineRepository,
      client: marineClient,
      mapper: marineMapper,
      mustCoverRequestedDates: (marineData) => marineData.hasSea,
    };
  }

  getForecast(location: LocationRef, coverThrough: LocalDate): Promise<SourceResult<ForecastData>> {
    return this.getSourceResult(this.forecastSource, location, coverThrough);
  }

  getMarine(location: LocationRef, coverThrough: LocalDate): Promise<SourceResult<MarineData>> {
    return this.getSourceResult(this.marineSource, location, coverThrough);
  }

  private async getSourceResult<WeatherData, ApiResponse, SnapshotRow>(
    source: WeatherSource<WeatherData, ApiResponse, SnapshotRow>,
    location: LocationRef,
    coverThrough: LocalDate,
  ): Promise<SourceResult<WeatherData>> {
    const latestSnapshot = await this.findLatestSnapshot(source, location);

    if (latestSnapshot && this.canReuseSnapshot(source, latestSnapshot, location, coverThrough)) {
      return { status: 'ok', data: latestSnapshot.data, fetchedAt: latestSnapshot.fetchedAt, stale: false };
    }

    try {
      const freshSnapshot = await this.fetchAndStoreSnapshot(source, location);
      return { status: 'ok', data: freshSnapshot.data, fetchedAt: freshSnapshot.fetchedAt, stale: false };
    } catch (error) {
      return this.resultAfterFailedFetch(error, latestSnapshot);
    }
  }

  private async findLatestSnapshot<WeatherData, ApiResponse, SnapshotRow>(
    source: WeatherSource<WeatherData, ApiResponse, SnapshotRow>,
    location: LocationRef,
  ): Promise<StoredSnapshot<WeatherData> | null> {
    const snapshotRow = await source.snapshotRepository.findLatest(location.id);
    return snapshotRow && source.mapper.toStored(snapshotRow);
  }

  private canReuseSnapshot<WeatherData, ApiResponse, SnapshotRow>(
    source: WeatherSource<WeatherData, ApiResponse, SnapshotRow>,
    snapshot: StoredSnapshot<WeatherData>,
    location: LocationRef,
    coverThrough: LocalDate,
  ): boolean {
    return isReusable({
      fetchedAt: snapshot.fetchedAt,
      now: this.clock.now(),
      refreshHours: source.refreshIntervalHours,
      timezone: location.timezone,
      coverThrough,
      requiresCoverage: source.mustCoverRequestedDates(snapshot.data),
    });
  }

  private fetchAndStoreSnapshot<WeatherData, ApiResponse, SnapshotRow>(
    source: WeatherSource<WeatherData, ApiResponse, SnapshotRow>,
    location: LocationRef,
  ): Promise<{ data: WeatherData; fetchedAt: Date }> {
    return this.singleFlight.run(`${source.name}:${location.id}`, async () => {
      const apiResponse = await source.client.fetch(location);
      const data = source.mapper.toData(apiResponse);
      const fetchedAt = this.clock.now();
      await source.snapshotRepository.insert(location.id, data, fetchedAt);
      return { data, fetchedAt };
    });
  }

  private resultAfterFailedFetch<WeatherData>(
    error: unknown,
    latestSnapshot: StoredSnapshot<WeatherData> | null,
  ): SourceResult<WeatherData> {
    const failureCause = toFailureCause(error);
    if (failureCause === null) {
      throw error;
    }

    const decision = decideAfterFailure({
      fetchedAt: latestSnapshot?.fetchedAt ?? null,
      now: this.clock.now(),
      maxStaleHours: this.weatherSettings.maxStaleHours,
    });

    if (latestSnapshot && decision === 'stale') {
      return { status: 'ok', data: latestSnapshot.data, fetchedAt: latestSnapshot.fetchedAt, stale: true };
    }
    if (latestSnapshot && decision === 'too_old') {
      return { status: 'too_old', fetchedAt: latestSnapshot.fetchedAt };
    }
    return { status: 'unavailable', cause: failureCause };
  }
}

function toFailureCause(error: unknown): SourceFailureCause | null {
  if (error instanceof OpenMeteoRateLimitedError) {
    return 'RATE_LIMITED';
  }
  if (error instanceof OpenMeteoUnavailableError || error instanceof OpenMeteoBadRequestError) {
    return 'TEMPORARILY_UNAVAILABLE';
  }
  return null;
}
