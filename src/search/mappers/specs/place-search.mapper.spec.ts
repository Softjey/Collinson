import { PlaceSearchMapper } from '../place-search.mapper.js';
import type { PlaceSearchWithPlaces } from '../../repositories/place.repository.js';

const place = (id: number) => ({
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
});

const row = (ids: number[]): PlaceSearchWithPlaces => ({
  id: 1,
  query: 'rome',
  language: 'en',
  countryCode: '',
  resultCount: 10,
  fetchedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  hits: ids.map((id) => ({ place: place(id) })),
});

const mapper = new PlaceSearchMapper();

describe('PlaceSearchMapper.toStoredSearch', () => {
  it('keeps the fetch time and the order of the hits', () => {
    expect(mapper.toStoredSearch(row([3, 1, 2]))).toEqual({
      fetchedAt: new Date('2026-01-01T00:00:00Z'),
      places: [place(3), place(1), place(2)],
    });
  });

  it('maps a search without hits to an empty list', () => {
    expect(mapper.toStoredSearch(row([])).places).toEqual([]);
  });
});
