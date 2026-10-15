import { Args, Query, Resolver } from '@nestjs/graphql';
import { SearchLocationsArgs } from './entities/search-locations.args.js';
import type { Place } from './entities/place.js';
import { PlaceSearchService } from './place-search.service.js';

@Resolver()
export class PlaceSearchResolver {
  constructor(private readonly searchService: PlaceSearchService) {}

  @Query('searchLocations')
  searchLocations(@Args() args: SearchLocationsArgs): Promise<Place[]> {
    return this.searchService.search(args);
  }
}
