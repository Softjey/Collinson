import { createTestPrisma, truncateAll } from '../../test/support/database.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../shared/database/prisma.service.js';
import type { Place } from './place.js';
import { PlaceRepository } from './place.repository.js';
import { searchKey } from './search-key.js';

function place(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    name: `Place ${id}`,
    country: 'Poland',
    countryCode: 'PL',
    admin1: null,
    latitude: 49.3,
    longitude: 19.9,
    elevation: null,
    timezone: null,
    population: null,
    ...overrides,
  };
}

describe('PlaceRepository', () => {
  let prisma: PrismaClient;
  let repository: PlaceRepository;
  const key = searchKey({ name: 'Zakopane', count: 10, language: 'en' });

  beforeAll(() => {
    prisma = createTestPrisma();
    repository = new PlaceRepository(prisma as unknown as PrismaService);
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('finds nothing for a search that was never stored', async () => {
    await expect(repository.findSearch(key)).resolves.toBeNull();
  });

  it('stores a search and returns its places in order', async () => {
    const fetchedAt = new Date('2026-10-13T10:00:00Z');
    const places = [place('30'), place('10'), place('20', { elevation: 838, population: 27266 })];

    await repository.saveSearch(key, places, fetchedAt);

    await expect(repository.findSearch(key)).resolves.toEqual({ fetchedAt, places });
  });

  it('stores an empty search', async () => {
    const fetchedAt = new Date('2026-10-13T10:00:00Z');

    await repository.saveSearch(key, [], fetchedAt);

    await expect(repository.findSearch(key)).resolves.toEqual({ fetchedAt, places: [] });
  });

  it('upserts places by id and updates a changed name', async () => {
    await repository.saveSearch(key, [place('1', { name: 'Old name' })], new Date());
    await repository.saveSearch(key, [place('1', { name: 'New name' })], new Date());

    const rows = await prisma.place.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, name: 'New name' });
  });

  it('replaces the hits of a refreshed search and updates fetchedAt', async () => {
    const first = new Date('2026-09-01T00:00:00Z');
    const second = new Date('2026-10-13T00:00:00Z');
    await repository.saveSearch(key, [place('1'), place('2'), place('3')], first);

    await repository.saveSearch(key, [place('3'), place('4')], second);

    const stored = await repository.findSearch(key);
    expect(stored?.fetchedAt).toEqual(second);
    expect(stored?.places.map((p) => p.id)).toEqual(['3', '4']);
    await expect(prisma.placeSearch.count()).resolves.toBe(1);
    await expect(prisma.placeSearchHit.count()).resolves.toBe(2);
  });

  it('lets the same place be a hit of two searches', async () => {
    const other = searchKey({ name: 'Zakopane', count: 5, language: 'en' });

    await repository.saveSearch(key, [place('1'), place('2')], new Date());
    await repository.saveSearch(other, [place('2')], new Date());

    expect((await repository.findSearch(key))?.places.map((p) => p.id)).toEqual(['1', '2']);
    expect((await repository.findSearch(other))?.places.map((p) => p.id)).toEqual(['2']);
    await expect(prisma.place.count()).resolves.toBe(2);
  });

  it('keeps searches with different keys apart', async () => {
    await repository.saveSearch(key, [place('1')], new Date());

    await expect(repository.findSearch({ ...key, language: 'pl' })).resolves.toBeNull();
    await expect(repository.findSearch({ ...key, countryCode: 'PL' })).resolves.toBeNull();
    await expect(repository.findSearch({ ...key, count: 5 })).resolves.toBeNull();
  });

  it('leaves the previous hits in place when a refresh fails', async () => {
    const fetchedAt = new Date('2026-09-01T00:00:00Z');
    await repository.saveSearch(key, [place('1')], fetchedAt);

    const broken = place('2', { latitude: Number.NaN, name: null as unknown as string });
    await expect(repository.saveSearch(key, [broken], new Date())).rejects.toThrow();

    const stored = await repository.findSearch(key);
    expect(stored?.places.map((p) => p.id)).toEqual(['1']);
    expect(stored?.fetchedAt).toEqual(fetchedAt);
  });
});
