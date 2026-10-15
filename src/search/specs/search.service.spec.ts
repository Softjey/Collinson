import { jest } from '@jest/globals';
import type { AppConfig } from '../../shared/config/env.schema.js';
import type { Clock } from '../../shared/clock.js';
import type { GeocodingClient } from '../geocoding.client.js';
import type { Place } from '../entities/place.js';
import type { StoredSearch } from '../entities/stored-search.js';
import type { PlaceSearchMapper } from '../mappers/place-search.mapper.js';
import type { PlaceRepository } from '../repositories/place.repository.js';
import { SearchKeyMapper } from '../mappers/search-key.mapper.js';
import { SearchService } from '../search.service.js';

const keys = new SearchKeyMapper();
const searchKey = keys.toKey.bind(keys);
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-31T12:00:00Z');
const input = { name: '  Zakopane ', count: 10, language: 'en' };

function place(id: number): Place {
  return {
    id,
    name: `Place ${id}`,
    country: null,
    countryCode: null,
    admin1: null,
    latitude: 1,
    longitude: 2,
    elevation: null,
    timezone: null,
    population: null,
  };
}

function stored(ageDays: number): StoredSearch {
  return { fetchedAt: new Date(NOW.getTime() - ageDays * DAY_MS), places: [place(1)] };
}

function createService(options: { stored?: StoredSearch | null; geocoderError?: Error } = {}) {
  const search = jest.fn<GeocodingClient['search']>();
  if (options.geocoderError) {
    search.mockRejectedValue(options.geocoderError);
  } else {
    search.mockResolvedValue([place(2)]);
  }
  const findSearch = jest
    .fn<PlaceRepository['findSearch']>()
    .mockResolvedValue((options.stored ?? null) as never);
  const saveSearch = jest.fn<PlaceRepository['saveSearch']>().mockResolvedValue();
  const clock: Clock = { now: () => NOW };
  const service = new SearchService(
    { search } as unknown as GeocodingClient,
    { findSearch, saveSearch } as unknown as PlaceRepository,
    { placeSearchCacheDays: 30 } as AppConfig,
    clock,
    keys,
    { toStoredSearch: (row: unknown) => row } as unknown as PlaceSearchMapper,
  );
  return { service, search, findSearch, saveSearch };
}

describe('SearchService', () => {
  it('returns a fresh stored search without calling the geocoder', async () => {
    const { service, search, saveSearch } = createService({ stored: stored(29) });

    await expect(service.search(input)).resolves.toEqual([place(1)]);

    expect(search).not.toHaveBeenCalled();
    expect(saveSearch).not.toHaveBeenCalled();
  });

  it('looks the search up by its normalised key', async () => {
    const { service, findSearch } = createService({ stored: stored(1) });

    await service.search(input);

    expect(findSearch).toHaveBeenCalledWith(searchKey(input));
  });

  it('calls the geocoder and stores the result when nothing is stored', async () => {
    const { service, search, saveSearch } = createService();

    await expect(service.search(input)).resolves.toEqual([place(2)]);

    expect(search).toHaveBeenCalledWith(input);
    expect(saveSearch).toHaveBeenCalledWith(searchKey(input), [place(2)], NOW);
  });

  it('refreshes a stored search older than the cache period', async () => {
    const { service, search, saveSearch } = createService({ stored: stored(31) });

    await expect(service.search(input)).resolves.toEqual([place(2)]);

    expect(search).toHaveBeenCalledTimes(1);
    expect(saveSearch).toHaveBeenCalledTimes(1);
  });

  it('returns the stale stored search when the geocoder fails', async () => {
    const { service, saveSearch } = createService({ stored: stored(90), geocoderError: new Error('down') });

    await expect(service.search(input)).resolves.toEqual([place(1)]);

    expect(saveSearch).not.toHaveBeenCalled();
  });

  it('fails with SERVICE_UNAVAILABLE when the geocoder fails and nothing is stored', async () => {
    const { service } = createService({ geocoderError: new Error('down') });

    await expect(service.search(input)).rejects.toMatchObject({
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
