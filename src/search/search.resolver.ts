import { Args, Query, Resolver } from '@nestjs/graphql';
import { SearchLocationsArgs } from './dto/search-locations.args.js';

@Resolver()
export class SearchResolver {
  @Query('searchLocations')
  searchLocations(@Args() _args: SearchLocationsArgs): never {
    throw new Error('searchLocations is not implemented');
  }
}
