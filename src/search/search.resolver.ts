import { Args, Query, Resolver } from '@nestjs/graphql';
import { SearchLocationsArgs } from './dto/search-locations.args.js';
import type { Place } from './place.js';
import { SearchService } from './search.service.js';

@Resolver()
export class SearchResolver {
  constructor(private readonly search: SearchService) {}

  @Query('searchLocations')
  searchLocations(@Args() args: SearchLocationsArgs): Promise<Place[]> {
    return this.search.search(args);
  }
}
