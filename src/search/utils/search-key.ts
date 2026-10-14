import type { SearchLocationsArgs } from '../entities/search-locations.args.js';

export interface SearchKey {
  query: string;
  language: string;
  countryCode: string;
  count: number;
}

export function searchKey(input: SearchLocationsArgs): SearchKey {
  return {
    query: input.name.trim().toLowerCase(),
    language: input.language,
    countryCode: input.countryCode ?? '',
    count: input.count,
  };
}
