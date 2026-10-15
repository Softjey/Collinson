import { jest } from '@jest/globals';
import type { AppConfig } from '../../shared/config/env.schema.js';
import type { Clock } from '../../shared/clock.js';
import type { GeocodingClient } from '../geocoding.client.js';
import { toPlaceSearchKey } from '../../../test/support/builders/place-search-key.js';
import { buildPlace } from '../../../test/support/builders/place.js';
import type { StoredPlaceSearch } from '../entities/stored-place-search.js';
import type { PlaceSearchMapper } from '../mappers/place-search.mapper.js';
import type { PlaceRepository } from '../repositories/place.repository.js';
import { PlaceSearchKeyMapper } from '../mappers/place-search-key.mapper.js';
import { PlaceSearchService } from '../place-search.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-31T12:00:00Z');
const input = { name: '  Zakopane ', count: 10, language: 'en' };

function stored(ageDays: number): StoredPlaceSearch {
  return { fetchedAt: new Date(NOW.getTime() - ageDays * DAY_MS), places: [buildPlace(1)] };
}

function createService(options: { stored?: StoredPlaceSearch | null; geocoderError?: Error } = {}) {
  const search = jest.fn<GeocodingClient['search']>();
  if (options.geocoderError) {
    search.mockRejectedValue(options.geocoderError);
  } else {
    search.mockResolvedValue([buildPlace(2)]);
  }
  const findSearch = jest
    .fn<PlaceRepository['findSearch']>()
    .mockResolvedValue((options.stored ?? null) as never);
  const saveSearch = jest.fn<PlaceRepository['saveSearch']>().mockResolvedValue();
  const clock: Clock = { now: () => NOW };
  const service = new PlaceSearchService(
    { search } as unknown as GeocodingClient,
    { findSearch, saveSearch } as unknown as PlaceRepository,
    { placeSearchCacheDays: 30 } as AppConfig,
    clock,
    new PlaceSearchKeyMapper(),
    { toStoredSearch: (row: unknown) => row } as unknown as PlaceSearchMapper,
  );
  return { service, search, findSearch, saveSearch };
}

describe('PlaceSearchService', () => {
  it('returns a fresh stored search without calling the geocoder', async () => {
    const { service, search, saveSearch } = createService({ stored: stored(29) });

    await expect(service.search(input)).resolves.toEqual([buildPlace(1)]);

    expect(search).not.toHaveBeenCalled();
    expect(saveSearch).not.toHaveBeenCalled();
  });

  it('looks the search up by its normalised key', async () => {
    const { service, findSearch } = createService({ stored: stored(1) });

    await service.search(input);

    expect(findSearch).toHaveBeenCalledWith(toPlaceSearchKey(input));
  });

  it('calls the geocoder and stores the result when nothing is stored', async () => {
    const { service, search, saveSearch } = createService();

    await expect(service.search(input)).resolves.toEqual([buildPlace(2)]);

    expect(search).toHaveBeenCalledWith(input);
    expect(saveSearch).toHaveBeenCalledWith(toPlaceSearchKey(input), [buildPlace(2)], NOW);
  });

  it('refreshes a stored search older than the cache period', async () => {
    const { service, search, saveSearch } = createService({ stored: stored(31) });

    await expect(service.search(input)).resolves.toEqual([buildPlace(2)]);

    expect(search).toHaveBeenCalledTimes(1);
    expect(saveSearch).toHaveBeenCalledTimes(1);
  });

  it('returns the stale stored search when the geocoder fails', async () => {
    const { service, saveSearch } = createService({ stored: stored(90), geocoderError: new Error('down') });

    await expect(service.search(input)).resolves.toEqual([buildPlace(1)]);

    expect(saveSearch).not.toHaveBeenCalled();
  });

  it('fails with SERVICE_UNAVAILABLE when the geocoder fails and nothing is stored', async () => {
    const { service } = createService({ geocoderError: new Error('down') });

    await expect(service.search(input)).rejects.toMatchObject({
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
