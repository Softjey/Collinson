import { Injectable } from '@nestjs/common';
import { toE2 } from '../shared/coordinates.js';
import type { Location } from './entities/location.js';
import { LocationRepository } from './repositories/location.repository.js';

@Injectable()
export class LocationService {
  constructor(private readonly locationRepository: LocationRepository) {}

  findOrCreate(latitude: number, longitude: number, timezone: string): Promise<Location> {
    return this.locationRepository.findOrCreate({
      latE2: toE2(latitude),
      lonE2: toE2(longitude),
      timezone,
    });
  }

  getElevation(location: Location): Promise<number | null> {
    return this.locationRepository.findElevation(location.id);
  }
}
