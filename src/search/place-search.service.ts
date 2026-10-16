import { Inject, Injectable, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { Clock } from '../shared/clock.js';
import { APP_CONFIG } from '../shared/config/config.module.js';
import type { AppConfig } from '../shared/config/env.schema.js';
import { Metrics } from '../shared/observability/metrics.js';
import { GeocodingClient } from './geocoding.client.js';
import type { Place } from './entities/place.js';
import { PlaceRepository } from './repositories/place.repository.js';
import type { StoredPlaceSearch } from './entities/stored-place-search.js';
import { PlaceSearchMapper } from './mappers/place-search.mapper.js';
import { PlaceSearchKeyMapper } from './mappers/place-search-key.mapper.js';
import type { SearchLocationsArgs } from './entities/search-locations.args.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PlaceSearchService {
  private readonly logger = new Logger(PlaceSearchService.name);

  constructor(
    private readonly geocodingClient: GeocodingClient,
    private readonly placeRepository: PlaceRepository,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    private readonly clock: Clock,
    private readonly searchKeyMapper: PlaceSearchKeyMapper,
    private readonly placeSearchMapper: PlaceSearchMapper,
    private readonly metrics: Metrics,
  ) {}

  async search(input: SearchLocationsArgs): Promise<Place[]> {
    const key = this.searchKeyMapper.toKey(input);
    const row = await this.placeRepository.findSearch(key);
    const stored = row && this.placeSearchMapper.toStoredSearch(row);

    if (stored && this.isFresh(stored)) {
      this.metrics.increment('placeSearch', { outcome: 'hit' });
      return stored.places;
    }

    try {
      const found = await this.geocodingClient.search(input);
      await this.placeRepository.saveSearch(key, found, this.clock.now());
      this.metrics.increment('placeSearch', { outcome: 'refreshed' });
      return found;
    } catch (error) {
      this.logger.warn(`Place search failed: ${error instanceof Error ? error.message : String(error)}`);
      if (stored) {
        this.metrics.increment('placeSearch', { outcome: 'stale_fallback' });
        return stored.places;
      }
      this.metrics.increment('placeSearch', { outcome: 'failed' });
      throw new GraphQLError('Place search is temporarily unavailable', {
        extensions: { code: 'SERVICE_UNAVAILABLE' },
      });
    }
  }

  private isFresh(stored: StoredPlaceSearch): boolean {
    return (
      this.clock.now().getTime() - stored.fetchedAt.getTime() < this.appConfig.placeSearchCacheDays * DAY_MS
    );
  }
}
