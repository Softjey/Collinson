import { Module } from '@nestjs/common';
import { LocationService } from './location.service.js';
import { LocationRepository } from './repositories/location.repository.js';

@Module({
  providers: [LocationService, LocationRepository],
  exports: [LocationService],
})
export class LocationModule {}
