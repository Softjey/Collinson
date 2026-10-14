import { Module } from '@nestjs/common';
import { Clock, SystemClock } from '../shared/clock.js';
import { OpenMeteoModule } from '../shared/open-meteo/open-meteo.module.js';
import { GeocodingClient } from './geocoding.client.js';
import { PlaceRepository } from './place.repository.js';
import { SearchResolver } from './search.resolver.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [OpenMeteoModule],
  providers: [SearchResolver, SearchService, GeocodingClient, PlaceRepository, { provide: Clock, useClass: SystemClock }],
})
export class SearchModule {}
