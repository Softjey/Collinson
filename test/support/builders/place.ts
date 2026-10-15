import type { Place } from '../../../src/search/entities/place.js';

export function buildPlace(id = 1, overrides: Partial<Place> = {}): Place {
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
    ...overrides,
  };
}
