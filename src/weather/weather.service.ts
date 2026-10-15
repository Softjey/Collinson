import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '../shared/clock.js';
import { APP_CONFIG } from '../shared/config/config.module.js';
import type { AppConfig } from '../shared/config/env.schema.js';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../shared/open-meteo/open-meteo.errors.js';
import { ForecastClient } from './forecast.client.js';
import { ForecastMapper } from './mappers/forecast.mapper.js';
import { MarineMapper } from './mappers/marine.mapper.js';
import { ForecastRepository, type ForecastSnapshotRow } from './repositories/forecast.repository.js';
import { decideAfterFailure, isReusable } from './utils/freshness.policy.js';
import { LocationRepository } from './repositories/location.repository.js';
import { MarineClient } from './marine.client.js';
import { MarineRepository, type MarineSnapshotRow } from './repositories/marine.repository.js';
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

interface SnapshotStore<T, Row> {
  findLatest(locationId: number): Promise<Row | null>;
  insert(locationId: number, data: T, fetchedAt: Date): Promise<{ id: number }>;
}

interface Source<T, Response, Row> {
  name: 'forecast' | 'marine';
  refreshHours: number;
  store: SnapshotStore<T, Row>;
  client: { fetch(location: LocationRef): Promise<Response> };
  mapper: { toData(response: Response): T; toStored(row: Row): StoredSnapshot<T> };
  requiresCoverage(data: T): boolean;
}

type WeatherSettings = Pick<AppConfig, 'weatherRefreshHours' | 'wavesRefreshHours' | 'maxStaleHours'>;

@Injectable()
export class WeatherService {
  private readonly flights = new SingleFlight();
  private readonly forecast: Source<ForecastData, ForecastResponse, ForecastSnapshotRow>;
  private readonly marine: Source<MarineData, MarineResponse, MarineSnapshotRow>;

  constructor(
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly settings: WeatherSettings,
    private readonly locations: LocationRepository,
    forecastClient: ForecastClient,
    marineClient: MarineClient,
    forecastSnapshots: ForecastRepository,
    marineSnapshots: MarineRepository,
    forecastMapper: ForecastMapper,
    marineMapper: MarineMapper,
  ) {
    this.forecast = {
      name: 'forecast',
      refreshHours: settings.weatherRefreshHours,
      store: forecastSnapshots,
      client: forecastClient,
      mapper: forecastMapper,
      requiresCoverage: () => true,
    };
    this.marine = {
      name: 'marine',
      refreshHours: settings.wavesRefreshHours,
      store: marineSnapshots,
      client: marineClient,
      mapper: marineMapper,
      requiresCoverage: (data) => data.hasSea,
    };
  }

  resolveLocation(latitude: number, longitude: number, timezone: string): Promise<LocationRef> {
    return this.locations.findOrCreate({
      latE2: Math.round(latitude * 100),
      lonE2: Math.round(longitude * 100),
      timezone,
    });
  }

  getForecast(location: LocationRef, coverThrough: LocalDate): Promise<SourceResult<ForecastData>> {
    return this.get(this.forecast, location, coverThrough);
  }

  getMarine(location: LocationRef, coverThrough: LocalDate): Promise<SourceResult<MarineData>> {
    return this.get(this.marine, location, coverThrough);
  }

  private async get<T, Response, Row>(
    source: Source<T, Response, Row>,
    location: LocationRef,
    coverThrough: LocalDate,
  ): Promise<SourceResult<T>> {
    const { clock, settings } = this;
    const row = await source.store.findLatest(location.id);
    const snapshot = row && source.mapper.toStored(row);

    if (
      snapshot &&
      isReusable({
        fetchedAt: snapshot.fetchedAt,
        now: clock.now(),
        refreshHours: source.refreshHours,
        timezone: location.timezone,
        coverThrough,
        requiresCoverage: source.requiresCoverage(snapshot.data),
      })
    ) {
      return { status: 'ok', data: snapshot.data, fetchedAt: snapshot.fetchedAt, stale: false };
    }

    try {
      const stored = await this.flights.run(`${source.name}:${location.id}`, async () => {
        const data = source.mapper.toData(await source.client.fetch(location));
        const fetchedAt = clock.now();
        await source.store.insert(location.id, data, fetchedAt);
        return { data, fetchedAt };
      });
      return { status: 'ok', data: stored.data, fetchedAt: stored.fetchedAt, stale: false };
    } catch (error) {
      const cause = failureCause(error);
      if (cause === null) {
        throw error;
      }
      const decision = decideAfterFailure({
        fetchedAt: snapshot?.fetchedAt ?? null,
        now: clock.now(),
        maxStaleHours: settings.maxStaleHours,
      });
      if (snapshot && decision === 'stale') {
        return { status: 'ok', data: snapshot.data, fetchedAt: snapshot.fetchedAt, stale: true };
      }
      if (snapshot && decision === 'too_old') {
        return { status: 'too_old', fetchedAt: snapshot.fetchedAt };
      }
      return { status: 'unavailable', cause };
    }
  }
}

function failureCause(error: unknown): SourceFailureCause | null {
  if (error instanceof OpenMeteoRateLimitedError) {
    return 'RATE_LIMITED';
  }
  if (error instanceof OpenMeteoUnavailableError || error instanceof OpenMeteoBadRequestError) {
    return 'TEMPORARILY_UNAVAILABLE';
  }
  return null;
}
