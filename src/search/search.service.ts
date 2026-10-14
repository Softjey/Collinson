import { Inject, Injectable, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { Clock } from '../shared/clock.js';
import { APP_CONFIG } from '../shared/config/config.module.js';
import type { AppConfig } from '../shared/config/env.schema.js';
import { GeocodingClient } from './geocoding.client.js';
import type { Place } from './place.js';
import { PlaceRepository, type StoredSearch } from './place.repository.js';
import { searchKey } from './search-key.js';
import type { SearchLocationsArgs } from './search-locations.args.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly geocoding: GeocodingClient,
    private readonly places: PlaceRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  async search(input: SearchLocationsArgs): Promise<Place[]> {
    const key = searchKey(input);
    const stored = await this.places.findSearch(key);

    if (stored && this.isFresh(stored)) {
      return stored.places;
    }

    try {
      const found = await this.geocoding.search(input);
      await this.places.saveSearch(key, found, this.clock.now());
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
    return this.clock.now().getTime() - stored.fetchedAt.getTime() < this.config.placeSearchCacheDays * DAY_MS;
  }
}
