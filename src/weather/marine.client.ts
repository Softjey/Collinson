import { Injectable } from '@nestjs/common';
import type { MarineResponse } from '../shared/open-meteo/schemas/marine.schema.js';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import { fromE2 } from '../shared/coordinates.js';
import type { LocationRef } from './entities/weather.types.js';

const HOURLY_VARIABLES = [
  'wave_height',
  'wave_period',
  'wave_direction',
  'swell_wave_height',
  'swell_wave_period',
] as const;

@Injectable()
export class MarineClient {
  constructor(private readonly openMeteoService: OpenMeteoService) {}

  fetch(location: Pick<LocationRef, 'latE2' | 'lonE2' | 'timezone'>): Promise<MarineResponse> {
    return this.openMeteoService.marine({
      latitude: fromE2(location.latE2),
      longitude: fromE2(location.lonE2),
      forecast_days: 8,
      timezone: location.timezone,
      timeformat: 'unixtime',
      cell_selection: 'sea',
      hourly: HOURLY_VARIABLES.join(','),
    });
  }
}
