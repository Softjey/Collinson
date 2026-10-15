import { z } from 'zod';
import { hourlySchema } from './hourly.js';

export const FORECAST_HOURLY_VARIABLES = [
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

export type ForecastHourlyVariable = (typeof FORECAST_HOURLY_VARIABLES)[number];

export const forecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().nullish(),
  utc_offset_seconds: z.number().int(),
  hourly: hourlySchema(FORECAST_HOURLY_VARIABLES),
});

export type ForecastResponse = z.output<typeof forecastResponseSchema>;
