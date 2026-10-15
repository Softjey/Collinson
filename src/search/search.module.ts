import { Module } from '@nestjs/common';
import { ClockModule } from '../shared/clock.module.js';
import { OpenMeteoModule } from '../shared/open-meteo/open-meteo.module.js';
import { GeocodingClient } from './geocoding.client.js';
import { PlaceSearchMapper } from './mappers/place-search.mapper.js';
import { SearchKeyMapper } from './mappers/search-key.mapper.js';
import { PlaceRepository } from './repositories/place.repository.js';
import { SearchResolver } from './search.resolver.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [OpenMeteoModule, ClockModule],
  providers: [
    SearchResolver,
    SearchService,
    GeocodingClient,
    PlaceRepository,
    PlaceSearchMapper,
    SearchKeyMapper,
  ],
})
export class SearchModule {}
