import { listPublicTables } from '../../../generated/prisma/sql.js';
import { useTestDatabase } from '../../../../test/support/database.js';

describe('database schema', () => {
  const database = useTestDatabase();
  const createLocation = (lonE2 = 1250) => database.prisma.location.create({ data: { latE2: 4185, lonE2 } });

  it('has been created by the migrations', async () => {
    const rows = await database.prisma.$queryRawTyped(listPublicTables());
    const tables = rows.map((row) => row.tableName);

    expect(tables).toEqual(
      expect.arrayContaining([
        'Location',
        'ForecastSnapshot',
        'ForecastHour',
        'MarineSnapshot',
        'MarineHour',
        'Place',
        'PlaceSearch',
        'PlaceSearchHit',
      ]),
    );
  });

  it('stores a location', async () => {
    const location = await createLocation();

    expect(location.elevationM).toBeNull();
    expect(location.timezone).toBeNull();
  });

  it('rejects a duplicate location with the same rounded coordinates', async () => {
    await createLocation();

    await expect(createLocation()).rejects.toThrow();
  });

  it('allows locations that differ in one coordinate', async () => {
    await createLocation();

    await expect(createLocation(1251)).resolves.toBeDefined();
  });

  it('deletes the hours when a forecast snapshot is deleted', async () => {
    const location = await createLocation();
    const snapshot = await database.prisma.forecastSnapshot.create({
      data: {
        locationId: location.id,
        parserVersion: 1,
        apiLatitude: 41.85,
        apiLongitude: 12.5,
        utcOffsetSeconds: 3600,
        hours: {
          create: [
            { timeUtc: new Date('2026-10-13T00:00:00Z') },
            { timeUtc: new Date('2026-10-13T01:00:00Z') },
          ],
        },
      },
    });

    await database.prisma.forecastSnapshot.delete({ where: { id: snapshot.id } });

    expect(await database.prisma.forecastHour.count()).toBe(0);
  });

  it('deletes the hours when a marine snapshot is deleted', async () => {
    const location = await createLocation();
    const snapshot = await database.prisma.marineSnapshot.create({
      data: {
        locationId: location.id,
        parserVersion: 1,
        hasSea: true,
        hours: { create: [{ timeUtc: new Date('2026-10-13T00:00:00Z'), waveHeight: 1.2 }] },
      },
    });

    await database.prisma.marineSnapshot.delete({ where: { id: snapshot.id } });

    expect(await database.prisma.marineHour.count()).toBe(0);
  });

  it('deletes the hits when a place search is deleted but keeps the places', async () => {
    const place = await database.prisma.place.create({
      data: { id: 3169070, name: 'Rome', latitude: 41.89, longitude: 12.48 },
    });
    const search = await database.prisma.placeSearch.create({
      data: {
        query: 'rome',
        language: 'en',
        resultCount: 10,
        hits: { create: [{ position: 0, placeId: place.id }] },
      },
    });

    await database.prisma.placeSearch.delete({ where: { id: search.id } });

    expect(await database.prisma.placeSearchHit.count()).toBe(0);
    expect(await database.prisma.place.count()).toBe(1);
  });

  it('rejects a second search with the same cache key', async () => {
    const data = { query: 'rome', language: 'en', countryCode: '', resultCount: 10 };
    await database.prisma.placeSearch.create({ data });

    await expect(database.prisma.placeSearch.create({ data })).rejects.toThrow();
  });
});
