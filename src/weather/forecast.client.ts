import { Injectable } from '@nestjs/common';
import type { ForecastResponse } from '../shared/open-meteo/schemas/forecast.schema.js';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import { fromE2 } from '../shared/coordinates.js';
import type { LocationRef } from './entities/weather.types.js';

const HOURLY_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'rain',
  'snowfall',
  'snow_depth',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'weather_code',
] as const;

@Injectable()
export class ForecastClient {
  constructor(private readonly openMeteoService: OpenMeteoService) {}

  fetch(location: Pick<LocationRef, 'latE2' | 'lonE2' | 'timezone'>): Promise<ForecastResponse> {
    return this.openMeteoService.forecast({
      latitude: fromE2(location.latE2),
      longitude: fromE2(location.lonE2),
      forecast_days: 8,
      timezone: location.timezone,
      timeformat: 'unixtime',
      hourly: HOURLY_VARIABLES.join(','),
    });
  }
}
