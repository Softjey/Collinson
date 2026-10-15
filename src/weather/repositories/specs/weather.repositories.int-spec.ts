import { BARCELONA, buildForecastData, buildMarineData } from '../../../../test/support/builders/weather.js';
import { useTestDatabase } from '../../../../test/support/database.js';
import { ForecastMapper } from '../../mappers/forecast.mapper.js';
import { MarineMapper } from '../../mappers/marine.mapper.js';
import { ForecastRepository } from '../forecast.repository.js';
import { LocationRepository } from '../location.repository.js';
import { MarineRepository } from '../marine.repository.js';

const forecastMapper = new ForecastMapper();
const marineMapper = new MarineMapper();

describe('weather repositories', () => {
  const database = useTestDatabase();
  let locations: LocationRepository;
  let forecasts: ForecastRepository;
  let marine: MarineRepository;

  const latestForecast = async (locationId: number) => {
    const row = await forecasts.findLatest(locationId);
    return row && forecastMapper.toStored(row);
  };
  const latestMarine = async (locationId: number) => {
    const row = await marine.findLatest(locationId);
    return row && marineMapper.toStored(row);
  };

  beforeAll(() => {
    locations = new LocationRepository(database.prisma);
    forecasts = new ForecastRepository(database.prisma);
    marine = new MarineRepository(database.prisma);
  });

  describe('LocationRepository', () => {
    it('creates a location with its time zone', async () => {
      const location = await locations.findOrCreate(BARCELONA);

      expect(location).toEqual({ id: expect.any(Number), ...BARCELONA });
      expect(await database.prisma.location.count()).toBe(1);
    });

    it('is idempotent', async () => {
      const first = await locations.findOrCreate(BARCELONA);
      const second = await locations.findOrCreate(BARCELONA);

      expect(second).toEqual(first);
      expect(await database.prisma.location.count()).toBe(1);
    });

    it('is safe under concurrent calls', async () => {
      const results = await Promise.all([
        locations.findOrCreate(BARCELONA),
        locations.findOrCreate(BARCELONA),
        locations.findOrCreate(BARCELONA),
      ]);

      expect(new Set(results.map((location) => location.id)).size).toBe(1);
      expect(await database.prisma.location.count()).toBe(1);
    });

    it('keeps the stored time zone when called with another one', async () => {
      await locations.findOrCreate(BARCELONA);

      const again = await locations.findOrCreate({ ...BARCELONA, timezone: 'UTC' });

      expect(again.timezone).toBe('Europe/Madrid');
    });

    it('fills in a missing time zone', async () => {
      const { id } = await locations.findOrCreate(BARCELONA);
      await database.prisma.location.update({ where: { id }, data: { timezone: null } });

      const again = await locations.findOrCreate(BARCELONA);

      expect(again).toMatchObject({ id, timezone: 'Europe/Madrid' });
      await expect(database.prisma.location.findUnique({ where: { id } })).resolves.toMatchObject({
        timezone: 'Europe/Madrid',
      });
    });

    it('keeps locations that differ in one coordinate apart', async () => {
      const a = await locations.findOrCreate(BARCELONA);
      const b = await locations.findOrCreate({ ...BARCELONA, lonE2: 219 });

      expect(b.id).not.toBe(a.id);
    });

    it('keeps the stored time zone when asked again with another one', async () => {
      await locations.findOrCreate(BARCELONA);

      const again = await locations.findOrCreate({ ...BARCELONA, timezone: 'Europe/Paris' });

      expect(again.timezone).toBe('Europe/Madrid');
    });

    it('fills in a missing time zone', async () => {
      await database.prisma.location.create({ data: { latE2: 4140, lonE2: 218 } });

      const location = await locations.findOrCreate(BARCELONA);

      expect(location.timezone).toBe('Europe/Madrid');
    });

    it('updates the elevation', async () => {
      const location = await locations.findOrCreate(BARCELONA);

      await locations.updateElevation(location.id, 33.5);

      const row = await database.prisma.location.findUniqueOrThrow({ where: { id: location.id } });
      expect(row.elevationM).toBe(33.5);
    });
  });

  describe('ForecastRepository', () => {
    it('writes a snapshot with 192 hours and updates the location elevation', async () => {
      const location = await locations.findOrCreate(BARCELONA);
      const fetchedAt = new Date('2026-10-13T08:00:00Z');

      const stored = await forecasts.insert(location.id, buildForecastData(), fetchedAt);

      expect(await database.prisma.forecastHour.count({ where: { snapshotId: stored.id } })).toBe(192);
      const row = await database.prisma.location.findUniqueOrThrow({ where: { id: location.id } });
      expect(row.elevationM).toBe(12);
      const snapshot = await database.prisma.forecastSnapshot.findUniqueOrThrow({ where: { id: stored.id } });
      expect(snapshot.parserVersion).toBe(1);
    });

    it('writes nothing when a hour row is invalid', async () => {
      const location = await locations.findOrCreate(BARCELONA);
      const data = buildForecastData();
      data.hours.push(...buildForecastData({}, 1).hours);

      await expect(forecasts.insert(location.id, data, new Date())).rejects.toThrow();

      expect(await database.prisma.forecastSnapshot.count()).toBe(0);
      expect(await database.prisma.forecastHour.count()).toBe(0);
      const row = await database.prisma.location.findUniqueOrThrow({ where: { id: location.id } });
      expect(row.elevationM).toBeNull();
    });

    it('does not clear the elevation when the response has none', async () => {
      const location = await locations.findOrCreate(BARCELONA);
      await locations.updateElevation(location.id, 12);

      await forecasts.insert(location.id, buildForecastData({ elevationM: null }, 2), new Date());

      const row = await database.prisma.location.findUniqueOrThrow({ where: { id: location.id } });
      expect(row.elevationM).toBe(12);
    });

    it('reads the snapshot back with its hours in time order and nulls kept', async () => {
      const location = await locations.findOrCreate(BARCELONA);
      const data = buildForecastData();
      await forecasts.insert(location.id, data, new Date('2026-10-13T08:00:00Z'));

      const latest = await latestForecast(location.id);

      expect(latest?.data).toEqual(data);
      expect(latest?.data.hours[5]?.temperature2m).toBeNull();
    });

    it('returns the newest snapshot by fetchedAt', async () => {
      const location = await locations.findOrCreate(BARCELONA);
      await forecasts.insert(
        location.id,
        buildForecastData({ apiLatitude: 1 }, 2),
        new Date('2026-10-13T08:00:00Z'),
      );
      await forecasts.insert(
        location.id,
        buildForecastData({ apiLatitude: 2 }, 2),
        new Date('2026-10-13T14:00:00Z'),
      );
      await forecasts.insert(
        location.id,
        buildForecastData({ apiLatitude: 3 }, 2),
        new Date('2026-10-13T02:00:00Z'),
      );

      const latest = await latestForecast(location.id);

      expect(latest?.data.apiLatitude).toBe(2);
    });

    it('breaks a fetchedAt tie by id', async () => {
      const location = await locations.findOrCreate(BARCELONA);
      const fetchedAt = new Date('2026-10-13T08:00:00Z');
      await forecasts.insert(location.id, buildForecastData({ apiLatitude: 1 }, 2), fetchedAt);
      const second = await forecasts.insert(location.id, buildForecastData({ apiLatitude: 2 }, 2), fetchedAt);

      const latest = await latestForecast(location.id);

      expect(latest?.id).toBe(second.id);
      expect(latest?.data.apiLatitude).toBe(2);
    });

    it('reads nothing for a location without snapshots', async () => {
      const location = await locations.findOrCreate(BARCELONA);

      expect(await latestForecast(location.id)).toBeNull();
    });

    it('does not return the snapshot of another location', async () => {
      const a = await locations.findOrCreate(BARCELONA);
      const b = await locations.findOrCreate({ ...BARCELONA, lonE2: 219 });
      await forecasts.insert(a.id, buildForecastData({}, 2), new Date());

      expect(await latestForecast(b.id)).toBeNull();
    });
  });

  describe('MarineRepository', () => {
    it('stores a coastal snapshot with its hours and reads it back', async () => {
      const location = await locations.findOrCreate(BARCELONA);
      const data = buildMarineData();

      await marine.insert(location.id, data, new Date('2026-10-13T08:00:00Z'));
      const latest = await latestMarine(location.id);

      expect(latest?.data).toEqual(data);
      expect(latest?.data.hours[2]?.wavePeriod).toBeNull();
    });

    it('stores an inland snapshot without hours and reads it back with hasSea false', async () => {
      const location = await locations.findOrCreate(BARCELONA);

      await marine.insert(
        location.id,
        { hasSea: false, apiLatitude: 40.42, apiLongitude: -3.7, hours: [] },
        new Date('2026-10-13T08:00:00Z'),
      );
      const latest = await latestMarine(location.id);

      expect(latest?.data.hasSea).toBe(false);
      expect(latest?.data.hours).toEqual([]);
      expect(await database.prisma.marineHour.count()).toBe(0);
    });

    it('returns the newest snapshot by fetchedAt, then by id', async () => {
      const location = await locations.findOrCreate(BARCELONA);
      const tie = new Date('2026-10-13T14:00:00Z');
      await marine.insert(location.id, buildMarineData({ apiLatitude: 1 }), new Date('2026-10-13T20:00:00Z'));
      await marine.insert(location.id, buildMarineData({ apiLatitude: 2 }), tie);
      const newestOfTie = await marine.insert(location.id, buildMarineData({ apiLatitude: 3 }), tie);

      const latest = await latestMarine(location.id);

      expect(latest?.data.apiLatitude).toBe(1);
      await database.prisma.marineSnapshot.deleteMany({ where: { apiLatitude: 1 } });
      expect((await latestMarine(location.id))?.id).toBe(newestOfTie.id);
    });

    it('reads nothing for a location without snapshots', async () => {
      const location = await locations.findOrCreate(BARCELONA);

      expect(await latestMarine(location.id)).toBeNull();
    });
  });
});
