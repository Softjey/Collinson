import { z } from 'zod';
import { hasEqualLengths, hourlyValues } from './hourly.js';

export const forecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().nullish(),
  utc_offset_seconds: z.number().int(),
  hourly: z
    .object({
      time: z.array(z.number().int()),
      temperature_2m: hourlyValues,
      relative_humidity_2m: hourlyValues,
      precipitation: hourlyValues,
      rain: hourlyValues,
      snowfall: hourlyValues,
      snow_depth: hourlyValues,
      cloud_cover: hourlyValues,
      wind_speed_10m: hourlyValues,
      wind_gusts_10m: hourlyValues,
      weather_code: hourlyValues,
    })
    .refine(hasEqualLengths, { message: 'hourly arrays must have the same length' }),
});

export type ForecastResponse = z.output<typeof forecastResponseSchema>;
