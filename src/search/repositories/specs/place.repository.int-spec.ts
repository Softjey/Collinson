import { buildPlace } from '../../../../test/support/builders/place.js';
import { useTestDatabase } from '../../../../test/support/database.js';
import type { PrismaService } from '../../../shared/database/prisma.service.js';
import type { PlaceSearchKey } from '../../mappers/place-search-key.mapper.js';
import { PlaceRepository } from '../place.repository.js';
import { PlaceSearchMapper } from '../../mappers/place-search.mapper.js';
import { toPlaceSearchKey } from '../../../../test/support/builders/place-search-key.js';

describe('PlaceRepository', () => {
  const database = useTestDatabase();
  let repository: PlaceRepository;
  const find = async (key: PlaceSearchKey) => {
    const row = await repository.findSearch(key);
    return row && new PlaceSearchMapper().toStoredSearch(row);
  };
  const key = toPlaceSearchKey({ name: 'Zakopane', count: 10, language: 'en' });

  beforeAll(() => {
    repository = new PlaceRepository(database.prisma as unknown as PrismaService);
  });

  it('finds nothing for a search that was never stored', async () => {
    await expect(find(key)).resolves.toBeNull();
  });

  it('stores a search and returns its places in order', async () => {
    const fetchedAt = new Date('2026-10-13T10:00:00Z');
    const places = [buildPlace(30), buildPlace(10), buildPlace(20, { elevation: 838, population: 27266 })];

    await repository.saveSearch(key, places, fetchedAt);

    await expect(find(key)).resolves.toEqual({ fetchedAt, places });
  });

  it('stores an empty search', async () => {
    const fetchedAt = new Date('2026-10-13T10:00:00Z');

    await repository.saveSearch(key, [], fetchedAt);

    await expect(find(key)).resolves.toEqual({ fetchedAt, places: [] });
  });

  it('upserts places by id and updates a changed name', async () => {
    await repository.saveSearch(key, [buildPlace(1, { name: 'Old name' })], new Date());
    await repository.saveSearch(key, [buildPlace(1, { name: 'New name' })], new Date());

    const rows = await database.prisma.place.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, name: 'New name' });
  });

  it('stores many places in one call, with nulls and a repeated id', async () => {
    const places = [
      buildPlace(1),
      buildPlace(2, { country: null, elevation: null, population: null }),
      buildPlace(1),
    ];

    await repository.saveSearch(key, places, new Date());

    await expect(database.prisma.place.count()).resolves.toBe(2);
    expect((await find(key))?.places.map((p) => p.id)).toEqual([1, 2, 1]);
    await expect(database.prisma.place.findUnique({ where: { id: 2 } })).resolves.toMatchObject({
      country: null,
      elevation: null,
      population: null,
    });
  });

  it('replaces the hits of a refreshed search and updates fetchedAt', async () => {
    const first = new Date('2026-09-01T00:00:00Z');
    const second = new Date('2026-10-13T00:00:00Z');
    await repository.saveSearch(key, [buildPlace(1), buildPlace(2), buildPlace(3)], first);

    await repository.saveSearch(key, [buildPlace(3), buildPlace(4)], second);

    const stored = await find(key);
    expect(stored?.fetchedAt).toEqual(second);
    expect(stored?.places.map((p) => p.id)).toEqual([3, 4]);
    await expect(database.prisma.placeSearch.count()).resolves.toBe(1);
    await expect(database.prisma.placeSearchHit.count()).resolves.toBe(2);
  });

  it('lets the same place be a hit of two searches', async () => {
    const other = toPlaceSearchKey({ name: 'Zakopane', count: 5, language: 'en' });

    await repository.saveSearch(key, [buildPlace(1), buildPlace(2)], new Date());
    await repository.saveSearch(other, [buildPlace(2)], new Date());

    expect((await find(key))?.places.map((p) => p.id)).toEqual([1, 2]);
    expect((await find(other))?.places.map((p) => p.id)).toEqual([2]);
    await expect(database.prisma.place.count()).resolves.toBe(2);
  });

  it('keeps searches with different keys apart', async () => {
    await repository.saveSearch(key, [buildPlace(1)], new Date());

    await expect(find({ ...key, language: 'pl' })).resolves.toBeNull();
    await expect(find({ ...key, countryCode: 'PL' })).resolves.toBeNull();
    await expect(find({ ...key, resultCount: 5 })).resolves.toBeNull();
  });

  it('leaves the previous hits in place when a refresh fails', async () => {
    const fetchedAt = new Date('2026-09-01T00:00:00Z');
    await repository.saveSearch(key, [buildPlace(1)], fetchedAt);

    const broken = buildPlace(2, { latitude: Number.NaN, name: null as unknown as string });
    await expect(repository.saveSearch(key, [broken], new Date())).rejects.toThrow();

    const stored = await find(key);
    expect(stored?.places.map((p) => p.id)).toEqual([1]);
    expect(stored?.fetchedAt).toEqual(fetchedAt);
  });
});
