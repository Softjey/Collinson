import { listPublicTables } from '../../../generated/prisma/sql.js';
import { createTestPrisma, truncateAll } from '../../../../test/support/database.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';

describe('database schema', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('has been created by the migrations', async () => {
    const rows = await prisma.$queryRawTyped(listPublicTables());
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
    const location = await prisma.location.create({ data: { latE2: 4185, lonE2: 1250 } });

    expect(location.elevationM).toBeNull();
    expect(location.timezone).toBeNull();
  });

  it('rejects a duplicate location with the same rounded coordinates', async () => {
    await prisma.location.create({ data: { latE2: 4185, lonE2: 1250 } });

    await expect(prisma.location.create({ data: { latE2: 4185, lonE2: 1250 } })).rejects.toThrow();
  });

  it('allows locations that differ in one coordinate', async () => {
    await prisma.location.create({ data: { latE2: 4185, lonE2: 1250 } });

    await expect(prisma.location.create({ data: { latE2: 4185, lonE2: 1251 } })).resolves.toBeDefined();
  });

  it('deletes the hours when a forecast snapshot is deleted', async () => {
    const location = await prisma.location.create({ data: { latE2: 4185, lonE2: 1250 } });
    const snapshot = await prisma.forecastSnapshot.create({
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

    await prisma.forecastSnapshot.delete({ where: { id: snapshot.id } });

    expect(await prisma.forecastHour.count()).toBe(0);
  });

  it('deletes the hours when a marine snapshot is deleted', async () => {
    const location = await prisma.location.create({ data: { latE2: 4185, lonE2: 1250 } });
    const snapshot = await prisma.marineSnapshot.create({
      data: {
        locationId: location.id,
        parserVersion: 1,
        hasSea: true,
        hours: { create: [{ timeUtc: new Date('2026-10-13T00:00:00Z'), waveHeight: 1.2 }] },
      },
    });

    await prisma.marineSnapshot.delete({ where: { id: snapshot.id } });

    expect(await prisma.marineHour.count()).toBe(0);
  });

  it('deletes the hits when a place search is deleted but keeps the places', async () => {
    const place = await prisma.place.create({
      data: { id: 3169070, name: 'Rome', latitude: 41.89, longitude: 12.48 },
    });
    const search = await prisma.placeSearch.create({
      data: {
        query: 'rome',
        language: 'en',
        resultCount: 10,
        hits: { create: [{ position: 0, placeId: place.id }] },
      },
    });

    await prisma.placeSearch.delete({ where: { id: search.id } });

    expect(await prisma.placeSearchHit.count()).toBe(0);
    expect(await prisma.place.count()).toBe(1);
  });

  it('rejects a second search with the same cache key', async () => {
    const data = { query: 'rome', language: 'en', countryCode: '', resultCount: 10 };
    await prisma.placeSearch.create({ data });

    await expect(prisma.placeSearch.create({ data })).rejects.toThrow();
  });
});
