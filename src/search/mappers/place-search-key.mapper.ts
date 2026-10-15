import { Injectable } from '@nestjs/common';
import type { SearchLocationsArgs } from '../entities/search-locations.args.js';

export interface PlaceSearchKey {
  query: string;
  language: string;
  countryCode: string;
  resultCount: number;
}

@Injectable()
export class PlaceSearchKeyMapper {
  toKey({ name, language, countryCode, count }: SearchLocationsArgs): PlaceSearchKey {
    return {
      query: name.trim().toLowerCase(),
      language,
      countryCode: countryCode ?? '',
      resultCount: count,
    };
  }
}
