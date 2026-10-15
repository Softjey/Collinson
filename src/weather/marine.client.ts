import { Injectable } from '@nestjs/common';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import { MarineMapper } from './mappers/marine.mapper.js';
import { fromE2 } from './mappers/convert.js';
import type { LocationRef, MarineData } from './entities/weather.types.js';

const HOURLY_VARIABLES = [
  'wave_height',
  'wave_period',
  'wave_direction',
  'swell_wave_height',
  'swell_wave_period',
] as const;

@Injectable()
export class MarineClient {
  constructor(
    private readonly openMeteo: OpenMeteoService,
    private readonly mapper: MarineMapper,
  ) {}

  async fetch(location: Pick<LocationRef, 'latE2' | 'lonE2' | 'timezone'>): Promise<MarineData> {
    const response = await this.openMeteo.marine({
      latitude: fromE2(location.latE2),
      longitude: fromE2(location.lonE2),
      forecast_days: 8,
      timezone: location.timezone,
      timeformat: 'unixtime',
      cell_selection: 'sea',
      hourly: HOURLY_VARIABLES.join(','),
    });
    return this.mapper.toData(response);
  }
}
