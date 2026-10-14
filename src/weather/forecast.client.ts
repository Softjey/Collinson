import { Injectable } from '@nestjs/common';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import type { ForecastResponse } from '../shared/open-meteo/schemas/forecast.schema.js';
import { fromE2, unixToDate } from './utils/convert.js';
import type { ForecastData, LocationRef } from './entities/weather.types.js';

// Bump when the mapping from the Forecast response to stored columns changes (new or renamed variable,
// unit change, different time handling), so rows written by older logic can be told apart.
export const FORECAST_PARSER_VERSION = 1;

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
  constructor(private readonly openMeteo: OpenMeteoService) {}

  async fetch(location: Pick<LocationRef, 'latE2' | 'lonE2' | 'timezone'>): Promise<ForecastData> {
    const response = await this.openMeteo.forecast({
      latitude: fromE2(location.latE2),
      longitude: fromE2(location.lonE2),
      forecast_days: 8,
      timezone: location.timezone,
      timeformat: 'unixtime',
      hourly: HOURLY_VARIABLES.join(','),
    });
    return toForecastData(response);
  }
}

function toForecastData(response: ForecastResponse): ForecastData {
  const { hourly } = response;
  return {
    apiLatitude: response.latitude,
    apiLongitude: response.longitude,
    elevationM: response.elevation ?? null,
    utcOffsetSeconds: response.utc_offset_seconds,
    hours: hourly.time.map((seconds, i) => ({
      timeUtc: unixToDate(seconds),
      temperature2m: hourly.temperature_2m[i] ?? null,
      relativeHumidity2m: hourly.relative_humidity_2m[i] ?? null,
      precipitation: hourly.precipitation[i] ?? null,
      rain: hourly.rain[i] ?? null,
      snowfall: hourly.snowfall[i] ?? null,
      snowDepth: hourly.snow_depth[i] ?? null,
      cloudCover: hourly.cloud_cover[i] ?? null,
      windSpeed10m: hourly.wind_speed_10m[i] ?? null,
      windGusts10m: hourly.wind_gusts_10m[i] ?? null,
      weatherCode: hourly.weather_code[i] ?? null,
    })),
  };
}
