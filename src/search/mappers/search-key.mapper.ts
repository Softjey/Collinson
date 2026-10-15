import type { SearchLocationsArgs } from '../entities/search-locations.args.js';

export interface SearchKey {
  query: string;
  language: string;
  countryCode: string;
  resultCount: number;
}

export function toSearchKey({ name, language, countryCode, count }: SearchLocationsArgs): SearchKey {
  return {
    query: name.trim().toLowerCase(),
    language,
    countryCode: countryCode ?? '',
    resultCount: count,
  };
}
