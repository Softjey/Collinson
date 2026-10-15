import { Injectable } from '@nestjs/common';
import type { SearchLocationsArgs } from '../entities/search-locations.args.js';

export interface SearchKey {
  query: string;
  language: string;
  countryCode: string;
  resultCount: number;
}

@Injectable()
export class SearchKeyMapper {
  toKey({ name, language, countryCode, count }: SearchLocationsArgs): SearchKey {
    return {
      query: name.trim().toLowerCase(),
      language,
      countryCode: countryCode ?? '',
      resultCount: count,
    };
  }
}
