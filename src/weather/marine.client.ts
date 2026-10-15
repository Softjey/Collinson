import { Injectable } from '@nestjs/common';
import type { MarineResponse } from '../shared/open-meteo/schemas/marine.schema.js';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import { fromE2 } from '../shared/coordinates.js';
import type { LocationRef } from './entities/weather.types.js';

@Injectable()
export class MarineClient {
  constructor(private readonly openMeteoService: OpenMeteoService) {}

  fetch(location: Pick<LocationRef, 'latE2' | 'lonE2' | 'timezone'>): Promise<MarineResponse> {
    return this.openMeteoService.marine({
      latitude: fromE2(location.latE2),
      longitude: fromE2(location.lonE2),
      timezone: location.timezone,
    });
  }
}
