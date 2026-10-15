import { Module } from '@nestjs/common';
import { ClockModule } from '../shared/clock.module.js';
import { OpenMeteoModule } from '../shared/open-meteo/open-meteo.module.js';
import { GeocodingClient } from './geocoding.client.js';
import { PlaceSearchMapper } from './mappers/place-search.mapper.js';
import { PlaceSearchKeyMapper } from './mappers/place-search-key.mapper.js';
import { PlaceRepository } from './repositories/place.repository.js';
import { PlaceSearchResolver } from './place-search.resolver.js';
import { PlaceSearchService } from './place-search.service.js';

@Module({
  imports: [OpenMeteoModule, ClockModule],
  providers: [
    PlaceSearchResolver,
    PlaceSearchService,
    GeocodingClient,
    PlaceRepository,
    PlaceSearchMapper,
    PlaceSearchKeyMapper,
  ],
})
export class PlaceSearchModule {}
