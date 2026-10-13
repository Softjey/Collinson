import { createTestPrisma, truncateAll } from '../../test/support/database.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { ForecastSnapshotRepository } from './forecast-snapshot.repository.js';
import { LocationRepository } from './location.repository.js';
import { MarineSnapshotRepository } from './marine-snapshot.repository.js';
import type { ForecastData, ForecastHourRow, MarineData, MarineHourRow } from './weather.types.js';

const START = Date.UTC(2026, 9, 12, 22);

function forecastData(overrides: Partial<ForecastData> = {}, hourCount = 192): ForecastData {
  const hours: ForecastHourRow[] = Array.from({ length: hourCount }, (_, i) => ({
    timeUtc: new Date(START + i * 3_600_000),
    temperature2m: i === 5 ? null : 15 + (i % 10),
    relativeHumidity2m: 60,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    snowDepth: 0,
    cloudCover: 40,
    windSpeed10m: 9.5,
    windGusts10m: 18,
    weatherCode: 3,
  }));
  return {
    apiLatitude: 41.4,
    apiLongitude: 2.18,
    elevationM: 12,
    utcOffsetSeconds: 7200,
    hours,
    ...overrides,
  };
}

function marineData(overrides: Partial<MarineData> = {}): MarineData {
  const hours: MarineHourRow[] = Array.from({ length: 24 }, (_, i) => ({
    timeUtc: new Date(START + i * 3_600_000),
    waveHeight: 1.25,
    wavePeriod: i === 2 ? null : 8,
    waveDirection: 120,
    swellWaveHeight: 0.5,
    swellWavePeriod: 9,
  }));
  return { hasSea: true, apiLatitude: 41.375, apiLongitude: 2.208, hours, ...overrides };
}

const barcelona = { latE2: 4140, lonE2: 218, timezone: 'Europe/Madrid' };

describe('weather repositories', () => {
  let prisma: PrismaClient;
  let locations: LocationRepository;
  let forecasts: ForecastSnapshotRepository;
  let marine: MarineSnapshotRepository;

  beforeAll(() => {
    prisma = createTestPrisma();
    locations = new LocationRepository(prisma);
    forecasts = new ForecastSnapshotRepository(prisma);
    marine = new MarineSnapshotRepository(prisma);
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('LocationRepository', () => {
    it('creates a location with its time zone', async () => {
      const location = await locations.findOrCreate(barcelona);

      expect(location).toEqual({ id: expect.any(Number), ...barcelona });
      expect(await prisma.location.count()).toBe(1);
    });

    it('is idempotent', async () => {
      const first = await locations.findOrCreate(barcelona);
      const second = await locations.findOrCreate(barcelona);

      expect(second).toEqual(first);
      expect(await prisma.location.count()).toBe(1);
    });

    it('is safe under concurrent calls', async () => {
      const results = await Promise.all([
        locations.findOrCreate(barcelona),
        locations.findOrCreate(barcelona),
        locations.findOrCreate(barcelona),
      ]);

      expect(new Set(results.map((location) => location.id)).size).toBe(1);
      expect(await prisma.location.count()).toBe(1);
    });

    it('keeps locations that differ in one coordinate apart', async () => {
      const a = await locations.findOrCreate(barcelona);
      const b = await locations.findOrCreate({ ...barcelona, lonE2: 219 });

      expect(b.id).not.toBe(a.id);
    });

    it('keeps the stored time zone when asked again with another one', async () => {
      await locations.findOrCreate(barcelona);

      const again = await locations.findOrCreate({ ...barcelona, timezone: 'Europe/Paris' });

      expect(again.timezone).toBe('Europe/Madrid');
    });

    it('fills in a missing time zone', async () => {
      await prisma.location.create({ data: { latE2: 4140, lonE2: 218 } });

      const location = await locations.findOrCreate(barcelona);

      expect(location.timezone).toBe('Europe/Madrid');
    });

    it('updates the elevation', async () => {
      const location = await locations.findOrCreate(barcelona);

      await locations.updateElevation(location.id, 33.5);

      const row = await prisma.location.findUniqueOrThrow({ where: { id: location.id } });
      expect(row.elevationM).toBe(33.5);
    });
  });

  describe('ForecastSnapshotRepository', () => {
    it('writes a snapshot with 192 hours and updates the location elevation', async () => {
      const location = await locations.findOrCreate(barcelona);
      const fetchedAt = new Date('2026-10-13T08:00:00Z');

      const stored = await forecasts.insert(location.id, forecastData(), fetchedAt);

      expect(stored.fetchedAt).toEqual(fetchedAt);
      expect(await prisma.forecastHour.count({ where: { snapshotId: stored.id } })).toBe(192);
      const row = await prisma.location.findUniqueOrThrow({ where: { id: location.id } });
      expect(row.elevationM).toBe(12);
      const snapshot = await prisma.forecastSnapshot.findUniqueOrThrow({ where: { id: stored.id } });
      expect(snapshot.parserVersion).toBe(1);
    });

    it('writes nothing when a hour row is invalid', async () => {
      const location = await locations.findOrCreate(barcelona);
      const data = forecastData();
      data.hours.push(...forecastData({}, 1).hours);

      await expect(forecasts.insert(location.id, data, new Date())).rejects.toThrow();

      expect(await prisma.forecastSnapshot.count()).toBe(0);
      expect(await prisma.forecastHour.count()).toBe(0);
      const row = await prisma.location.findUniqueOrThrow({ where: { id: location.id } });
      expect(row.elevationM).toBeNull();
    });

    it('does not clear the elevation when the response has none', async () => {
      const location = await locations.findOrCreate(barcelona);
      await locations.updateElevation(location.id, 12);

      await forecasts.insert(location.id, forecastData({ elevationM: null }, 2), new Date());

      const row = await prisma.location.findUniqueOrThrow({ where: { id: location.id } });
      expect(row.elevationM).toBe(12);
    });

    it('reads the snapshot back with its hours in time order and nulls kept', async () => {
      const location = await locations.findOrCreate(barcelona);
      const data = forecastData();
      await forecasts.insert(location.id, data, new Date('2026-10-13T08:00:00Z'));

      const latest = await forecasts.findLatest(location.id);

      expect(latest?.data).toEqual(data);
      expect(latest?.data.hours[5]?.temperature2m).toBeNull();
    });

    it('returns the newest snapshot by fetchedAt', async () => {
      const location = await locations.findOrCreate(barcelona);
      await forecasts.insert(location.id, forecastData({ apiLatitude: 1 }, 2), new Date('2026-10-13T08:00:00Z'));
      await forecasts.insert(location.id, forecastData({ apiLatitude: 2 }, 2), new Date('2026-10-13T14:00:00Z'));
      await forecasts.insert(location.id, forecastData({ apiLatitude: 3 }, 2), new Date('2026-10-13T02:00:00Z'));

      const latest = await forecasts.findLatest(location.id);

      expect(latest?.data.apiLatitude).toBe(2);
    });

    it('breaks a fetchedAt tie by id', async () => {
      const location = await locations.findOrCreate(barcelona);
      const fetchedAt = new Date('2026-10-13T08:00:00Z');
      await forecasts.insert(location.id, forecastData({ apiLatitude: 1 }, 2), fetchedAt);
      const second = await forecasts.insert(location.id, forecastData({ apiLatitude: 2 }, 2), fetchedAt);

      const latest = await forecasts.findLatest(location.id);

      expect(latest?.id).toBe(second.id);
      expect(latest?.data.apiLatitude).toBe(2);
    });

    it('reads nothing for a location without snapshots', async () => {
      const location = await locations.findOrCreate(barcelona);

      expect(await forecasts.findLatest(location.id)).toBeNull();
    });

    it('does not return the snapshot of another location', async () => {
      const a = await locations.findOrCreate(barcelona);
      const b = await locations.findOrCreate({ ...barcelona, lonE2: 219 });
      await forecasts.insert(a.id, forecastData({}, 2), new Date());

      expect(await forecasts.findLatest(b.id)).toBeNull();
    });
  });

  describe('MarineSnapshotRepository', () => {
    it('stores a coastal snapshot with its hours and reads it back', async () => {
      const location = await locations.findOrCreate(barcelona);
      const data = marineData();

      await marine.insert(location.id, data, new Date('2026-10-13T08:00:00Z'));
      const latest = await marine.findLatest(location.id);

      expect(latest?.data).toEqual(data);
      expect(latest?.data.hours[2]?.wavePeriod).toBeNull();
    });

    it('stores an inland snapshot without hours and reads it back with hasSea false', async () => {
      const location = await locations.findOrCreate(barcelona);

      await marine.insert(
        location.id,
        { hasSea: false, apiLatitude: 40.42, apiLongitude: -3.7, hours: [] },
        new Date('2026-10-13T08:00:00Z'),
      );
      const latest = await marine.findLatest(location.id);

      expect(latest?.data.hasSea).toBe(false);
      expect(latest?.data.hours).toEqual([]);
      expect(await prisma.marineHour.count()).toBe(0);
    });

    it('returns the newest snapshot by fetchedAt, then by id', async () => {
      const location = await locations.findOrCreate(barcelona);
      const tie = new Date('2026-10-13T14:00:00Z');
      await marine.insert(location.id, marineData({ apiLatitude: 1 }), new Date('2026-10-13T20:00:00Z'));
      await marine.insert(location.id, marineData({ apiLatitude: 2 }), tie);
      const newestOfTie = await marine.insert(location.id, marineData({ apiLatitude: 3 }), tie);

      const latest = await marine.findLatest(location.id);

      expect(latest?.data.apiLatitude).toBe(1);
      await prisma.marineSnapshot.deleteMany({ where: { apiLatitude: 1 } });
      expect((await marine.findLatest(location.id))?.id).toBe(newestOfTie.id);
    });

    it('reads nothing for a location without snapshots', async () => {
      const location = await locations.findOrCreate(barcelona);

      expect(await marine.findLatest(location.id)).toBeNull();
    });
  });
});
