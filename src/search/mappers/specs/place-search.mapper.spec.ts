import { buildPlace } from '../../../../test/support/builders/place.js';
import { PlaceSearchMapper } from '../place-search.mapper.js';
import type { PlaceSearchWithPlaces } from '../../repositories/place.repository.js';

const row = (ids: number[]): PlaceSearchWithPlaces => ({
  id: 1,
  query: 'rome',
  language: 'en',
  countryCode: '',
  resultCount: 10,
  fetchedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  hits: ids.map((id) => ({ place: buildPlace(id) })),
});

const mapper = new PlaceSearchMapper();

describe('PlaceSearchMapper.toStoredSearch', () => {
  it('keeps the fetch time and the order of the hits', () => {
    expect(mapper.toStoredSearch(row([3, 1, 2]))).toEqual({
      fetchedAt: new Date('2026-01-01T00:00:00Z'),
      places: [buildPlace(3), buildPlace(1), buildPlace(2)],
    });
  });

  it('maps a search without hits to an empty list', () => {
    expect(mapper.toStoredSearch(row([])).places).toEqual([]);
  });
});
