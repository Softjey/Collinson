import { jest } from '@jest/globals';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../../shared/open-meteo/open-meteo.errors.js';
import type { Clock } from '../../shared/clock.js';
import type {
  ForecastData,
  LocationRef,
  MarineData,
  SourceResult,
  StoredSnapshot,
} from '../entities/weather.types.js';
import type { ForecastClient } from '../forecast.client.js';
import type { ForecastRepository } from '../repositories/forecast.repository.js';
import type { LocationRepository } from '../repositories/location.repository.js';
import type { MarineClient } from '../marine.client.js';
import type { MarineRepository } from '../repositories/marine.repository.js';
import { WeatherService } from '../weather.service.js';

const HOUR = 3_600_000;
const NOW = new Date('2026-10-13T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

const location: LocationRef = { id: 1, latE2: 4140, lonE2: 218, timezone: 'Europe/Madrid' };
const otherLocation: LocationRef = { id: 2, latE2: 4850, lonE2: 235, timezone: 'Europe/Paris' };

const forecastData: ForecastData = {
  apiLatitude: 41.4,
  apiLongitude: 2.18,
  elevationM: 12,
  utcOffsetSeconds: 7200,
  hours: [],
};
const freshForecastData: ForecastData = { ...forecastData, apiLatitude: 99 };
const seaData: MarineData = { hasSea: true, apiLatitude: 41.37, apiLongitude: 2.2, hours: [] };
const inlandData: MarineData = { hasSea: false, apiLatitude: 40.4, apiLongitude: -3.7, hours: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function snapshotStore<T>(initial: Record<number, StoredSnapshot<T>> = {}) {
  const rows = new Map<number, StoredSnapshot<T>>(
    Object.entries(initial).map(([id, row]) => [Number(id), row]),
  );
  let nextId = 100;
  return {
    findLatest: jest.fn(async (locationId: number) => rows.get(locationId) ?? null),
    insert: jest.fn(async (locationId: number, data: T, fetchedAt: Date) => {
      const row = { id: nextId++, fetchedAt, data };
      rows.set(locationId, row);
      return row;
    }),
  };
}

function setup(
  options: {
    forecast?: StoredSnapshot<ForecastData>;
    marine?: StoredSnapshot<MarineData>;
    forecastFetch?: () => Promise<ForecastData>;
    marineFetch?: () => Promise<MarineData>;
  } = {},
) {
  const clock: Clock = { now: () => NOW };
  const forecastSnapshots = snapshotStore<ForecastData>(options.forecast ? { 1: options.forecast } : {});
  const marineSnapshots = snapshotStore<MarineData>(options.marine ? { 1: options.marine } : {});
  const forecastClient = { fetch: jest.fn(options.forecastFetch ?? (async () => freshForecastData)) };
  const marineClient = { fetch: jest.fn(options.marineFetch ?? (async () => seaData)) };
  const locations = {
    findOrCreate: jest.fn(async (input: Omit<LocationRef, 'id'>) => ({ id: 1, ...input })),
  };
  const service = new WeatherService(
    clock,
    { weatherRefreshHours: 6, wavesRefreshHours: 24, maxStaleHours: 48 },
    locations as unknown as LocationRepository,
    forecastClient as unknown as ForecastClient,
    marineClient as unknown as MarineClient,
    forecastSnapshots as unknown as ForecastRepository,
    marineSnapshots as unknown as MarineRepository,
  );
  return { service, forecastSnapshots, marineSnapshots, forecastClient, marineClient, locations };
}

const forecastRow = (hours: number, data = forecastData): StoredSnapshot<ForecastData> => ({
  id: 7,
  fetchedAt: hoursAgo(hours),
  data,
});
const marineRow = (hours: number, data = seaData): StoredSnapshot<MarineData> => ({
  id: 8,
  fetchedAt: hoursAgo(hours),
  data,
});

describe('WeatherService', () => {
  describe('resolveLocation', () => {
    it('finds or creates the location with rounded coordinates and the time zone', async () => {
      const { service, locations } = setup();

      const result = await service.resolveLocation(41.404, -2.178, 'Europe/Madrid');

      expect(locations.findOrCreate).toHaveBeenCalledWith({
        latE2: 4140,
        lonE2: -218,
        timezone: 'Europe/Madrid',
      });
      expect(result).toEqual({ id: 1, latE2: 4140, lonE2: -218, timezone: 'Europe/Madrid' });
    });
  });

  describe('getForecast', () => {
    it('reuses a snapshot within the interval that covers the date, without calling upstream', async () => {
      const { service, forecastClient, forecastSnapshots } = setup({ forecast: forecastRow(2) });

      const result = await service.getForecast(location, '2026-10-20');

      expect(result).toEqual({ status: 'ok', data: forecastData, fetchedAt: hoursAgo(2), stale: false });
      expect(forecastClient.fetch).not.toHaveBeenCalled();
      expect(forecastSnapshots.insert).not.toHaveBeenCalled();
    });

    it('fetches, stores and returns a new snapshot when the stored one is older than 6 hours', async () => {
      const { service, forecastClient, forecastSnapshots } = setup({ forecast: forecastRow(7) });

      const result = await service.getForecast(location, '2026-10-20');

      expect(result).toEqual({ status: 'ok', data: freshForecastData, fetchedAt: NOW, stale: false });
      expect(forecastClient.fetch).toHaveBeenCalledWith(location);
      expect(forecastSnapshots.insert).toHaveBeenCalledWith(location.id, freshForecastData, NOW);
    });

    it('fetches when there is no snapshot', async () => {
      const { service, forecastClient } = setup();

      const result = await service.getForecast(location, '2026-10-20');

      expect(result.status).toBe('ok');
      expect(forecastClient.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetches when the snapshot is within the interval but does not cover coverThrough', async () => {
      const { service, forecastClient } = setup({ forecast: forecastRow(2) });

      const result = await service.getForecast(location, '2026-10-21');

      expect(forecastClient.fetch).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ status: 'ok', data: freshForecastData, stale: false });
    });

    it('serves a 47 hour old snapshot as stale when the fetch fails', async () => {
      const { service, forecastSnapshots } = setup({
        forecast: forecastRow(47),
        forecastFetch: async () => {
          throw new OpenMeteoUnavailableError('down');
        },
      });

      const result = await service.getForecast(location, '2026-10-20');

      expect(result).toEqual({ status: 'ok', data: forecastData, fetchedAt: hoursAgo(47), stale: true });
      expect(forecastSnapshots.insert).not.toHaveBeenCalled();
    });

    it('reports a 49 hour old snapshot as too old when the fetch fails', async () => {
      const { service } = setup({
        forecast: forecastRow(49),
        forecastFetch: async () => {
          throw new OpenMeteoUnavailableError('down');
        },
      });

      const result = await service.getForecast(location, '2026-10-20');

      expect(result).toEqual({ status: 'too_old', fetchedAt: hoursAgo(49) });
    });

    it('reports RATE_LIMITED when the fetch is limited and there is no snapshot', async () => {
      const { service } = setup({
        forecastFetch: async () => {
          throw new OpenMeteoRateLimitedError();
        },
      });

      const result = await service.getForecast(location, '2026-10-20');

      expect(result).toEqual({ status: 'unavailable', cause: 'RATE_LIMITED' });
    });

    it.each([
      ['unavailable', new OpenMeteoUnavailableError('down')],
      ['bad request', new OpenMeteoBadRequestError('bad')],
    ])('reports TEMPORARILY_UNAVAILABLE for a %s failure with no snapshot', async (_name, error) => {
      const { service } = setup({
        forecastFetch: async () => {
          throw error;
        },
      });

      const result = await service.getForecast(location, '2026-10-20');

      expect(result).toEqual({ status: 'unavailable', cause: 'TEMPORARILY_UNAVAILABLE' });
    });

    it('lets an unexpected error propagate instead of hiding it as unavailable', async () => {
      const failure = new TypeError('bug');
      const { service } = setup({
        forecastFetch: async () => {
          throw failure;
        },
      });

      await expect(service.getForecast(location, '2026-10-20')).rejects.toBe(failure);
    });

    it('uses a 6 hour interval', async () => {
      const fresh = setup({ forecast: forecastRow(5.9) });
      const old = setup({ forecast: forecastRow(6.1) });

      await fresh.service.getForecast(location, '2026-10-20');
      await old.service.getForecast(location, '2026-10-20');

      expect(fresh.forecastClient.fetch).not.toHaveBeenCalled();
      expect(old.forecastClient.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMarine', () => {
    it('uses a 24 hour interval', async () => {
      const fresh = setup({ marine: marineRow(23.9) });
      const old = setup({ marine: marineRow(24.1) });

      const reused = await fresh.service.getMarine(location, '2026-10-19');
      await old.service.getMarine(location, '2026-10-19');

      expect(reused).toMatchObject({ status: 'ok', data: seaData, stale: false });
      expect(fresh.marineClient.fetch).not.toHaveBeenCalled();
      expect(old.marineClient.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetches and stores when the snapshot is older than 24 hours', async () => {
      const { service, marineSnapshots } = setup({ marine: marineRow(30) });

      const result = await service.getMarine(location, '2026-10-20');

      expect(result).toEqual({ status: 'ok', data: seaData, fetchedAt: NOW, stale: false });
      expect(marineSnapshots.insert).toHaveBeenCalledWith(location.id, seaData, NOW);
    });

    it('fetches when a sea snapshot does not cover coverThrough', async () => {
      const { service, marineClient } = setup({ marine: marineRow(2) });

      await service.getMarine(location, '2026-10-21');

      expect(marineClient.fetch).toHaveBeenCalledTimes(1);
    });

    it('reuses an inland snapshot within 24 hours whatever coverThrough is', async () => {
      const { service, marineClient } = setup({ marine: marineRow(20, inlandData) });

      const result = await service.getMarine(location, '2030-01-01');

      expect(result).toMatchObject({ status: 'ok', data: inlandData, stale: false });
      expect(marineClient.fetch).not.toHaveBeenCalled();
    });

    it('refetches an inland snapshot older than 24 hours', async () => {
      const { service, marineClient } = setup({ marine: marineRow(25, inlandData) });

      await service.getMarine(location, '2026-10-20');

      expect(marineClient.fetch).toHaveBeenCalledTimes(1);
    });

    it('serves a stale snapshot, reports too old, and reports unavailable like the forecast', async () => {
      const failing = async () => {
        throw new OpenMeteoRateLimitedError();
      };
      const stale = await setup({ marine: marineRow(47), marineFetch: failing }).service.getMarine(
        location,
        '2026-10-20',
      );
      const tooOld = await setup({ marine: marineRow(49), marineFetch: failing }).service.getMarine(
        location,
        '2026-10-20',
      );
      const none = await setup({ marineFetch: failing }).service.getMarine(location, '2026-10-20');

      expect(stale).toEqual({ status: 'ok', data: seaData, fetchedAt: hoursAgo(47), stale: true });
      expect(tooOld).toEqual({ status: 'too_old', fetchedAt: hoursAgo(49) });
      expect(none).toEqual({ status: 'unavailable', cause: 'RATE_LIMITED' });
    });
  });

  describe('single flight', () => {
    it('makes one upstream call and one insert for concurrent calls of the same location and source', async () => {
      const gate = deferred<ForecastData>();
      const { service, forecastClient, forecastSnapshots } = setup({ forecastFetch: () => gate.promise });

      const first = service.getForecast(location, '2026-10-20');
      const second = service.getForecast(location, '2026-10-20');
      await new Promise((resolve) => setImmediate(resolve));
      gate.resolve(freshForecastData);
      const results = await Promise.all([first, second]);

      expect(forecastClient.fetch).toHaveBeenCalledTimes(1);
      expect(forecastSnapshots.insert).toHaveBeenCalledTimes(1);
      expect(results.map((result: SourceResult<ForecastData>) => result.status)).toEqual(['ok', 'ok']);
    });

    it('does not share a flight between forecast and marine', async () => {
      const { service, forecastClient, marineClient } = setup();

      await Promise.all([
        service.getForecast(location, '2026-10-20'),
        service.getMarine(location, '2026-10-20'),
      ]);

      expect(forecastClient.fetch).toHaveBeenCalledTimes(1);
      expect(marineClient.fetch).toHaveBeenCalledTimes(1);
    });

    it('does not share a flight between two locations', async () => {
      const { service, forecastClient } = setup();

      await Promise.all([
        service.getForecast(location, '2026-10-20'),
        service.getForecast(otherLocation, '2026-10-20'),
      ]);

      expect(forecastClient.fetch).toHaveBeenCalledTimes(2);
    });

    it('tries again after a failed flight', async () => {
      let calls = 0;
      const { service, forecastClient } = setup({
        forecastFetch: async () => {
          calls += 1;
          if (calls === 1) {
            throw new OpenMeteoUnavailableError('down');
          }
          return freshForecastData;
        },
      });

      const first = await service.getForecast(location, '2026-10-20');
      const second = await service.getForecast(location, '2026-10-20');

      expect(first).toEqual({ status: 'unavailable', cause: 'TEMPORARILY_UNAVAILABLE' });
      expect(second).toMatchObject({ status: 'ok', data: freshForecastData });
      expect(forecastClient.fetch).toHaveBeenCalledTimes(2);
    });

    it('gives every concurrent caller the failure of a failed flight', async () => {
      const gate = deferred<ForecastData>();
      const { service, forecastClient } = setup({ forecastFetch: () => gate.promise });

      const first = service.getForecast(location, '2026-10-20');
      const second = service.getForecast(location, '2026-10-20');
      await new Promise((resolve) => setImmediate(resolve));
      gate.reject(new OpenMeteoRateLimitedError());
      const results = await Promise.all([first, second]);

      expect(forecastClient.fetch).toHaveBeenCalledTimes(1);
      expect(results).toEqual([
        { status: 'unavailable', cause: 'RATE_LIMITED' },
        { status: 'unavailable', cause: 'RATE_LIMITED' },
      ]);
    });
  });
});
