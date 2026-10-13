import { Inject, Injectable, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { APP_CONFIG } from '../shared/config/config.module.js';
import type { AppConfig } from '../shared/config/env.schema.js';
import { GeocodingClient } from './geocoding.client.js';
import type { Place } from './place.js';
import { PlaceRepository, type StoredSearch } from './place.repository.js';
import { searchKey } from './search-key.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SearchPlacesInput {
  name: string;
  count: number;
  language: string;
  countryCode?: string | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly geocoding: GeocodingClient,
    private readonly places: PlaceRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async search(input: SearchPlacesInput): Promise<Place[]> {
    const key = searchKey(input);
    const stored = await this.places.findSearch(key);

    if (stored && this.isFresh(stored)) {
      return stored.places;
    }

    try {
      const found = await this.geocoding.search({
        name: input.name.trim(),
        count: input.count,
        language: input.language,
        countryCode: input.countryCode ?? undefined,
      });
      await this.places.saveSearch(key, found, new Date());
      return found;
    } catch (error) {
      this.logger.warn(`Place search failed: ${error instanceof Error ? error.message : String(error)}`);
      if (stored) {
        return stored.places;
      }
      throw new GraphQLError('Place search is temporarily unavailable', {
        extensions: { code: 'SERVICE_UNAVAILABLE' },
      });
    }
  }

  private isFresh(stored: StoredSearch): boolean {
    return Date.now() - stored.fetchedAt.getTime() < this.config.placeSearchCacheDays * DAY_MS;
  }
}
