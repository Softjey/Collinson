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
import { ForecastSnapshotRepository } from './forecast-snapshot.repository.js';
import { decideAfterFailure, isReusable } from './freshness.policy.js';
import { LocationRepository } from './location.repository.js';
import { MarineClient } from './marine.client.js';
import { MarineSnapshotRepository } from './marine-snapshot.repository.js';
import { SingleFlight } from '../shared/single-flight.js';
import type {
  ForecastData,
  LocalDate,
  LocationRef,
  MarineData,
  SourceFailureCause,
  SourceResult,
  StoredSnapshot,
} from './weather.types.js';

interface SnapshotStore<T> {
  findLatest(locationId: number): Promise<StoredSnapshot<T> | null>;
  insert(locationId: number, data: T, fetchedAt: Date): Promise<StoredSnapshot<T>>;
}

interface Source<T> {
  name: 'forecast' | 'marine';
  refreshHours: number;
  store: SnapshotStore<T>;
  client: { fetch(location: LocationRef): Promise<T> };
  requiresCoverage(data: T): boolean;
}

type WeatherSettings = Pick<AppConfig, 'weatherRefreshHours' | 'wavesRefreshHours' | 'maxStaleHours'>;

@Injectable()
export class WeatherService {
  private readonly flights = new SingleFlight();
  private readonly forecast: Source<ForecastData>;
  private readonly marine: Source<MarineData>;

  constructor(
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly settings: WeatherSettings,
    private readonly locations: LocationRepository,
    forecastClient: ForecastClient,
    marineClient: MarineClient,
    forecastSnapshots: ForecastSnapshotRepository,
    marineSnapshots: MarineSnapshotRepository,
  ) {
    this.forecast = {
      name: 'forecast',
      refreshHours: settings.weatherRefreshHours,
      store: forecastSnapshots,
      client: forecastClient,
      requiresCoverage: () => true,
    };
    this.marine = {
      name: 'marine',
      refreshHours: settings.wavesRefreshHours,
      store: marineSnapshots,
      client: marineClient,
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

  private async get<T>(
    source: Source<T>,
    location: LocationRef,
    coverThrough: LocalDate,
  ): Promise<SourceResult<T>> {
    const { clock, settings } = this;
    const snapshot = await source.store.findLatest(location.id);

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
        const data = await source.client.fetch(location);
        return source.store.insert(location.id, data, clock.now());
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
