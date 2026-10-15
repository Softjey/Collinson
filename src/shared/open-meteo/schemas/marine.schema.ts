import { z } from 'zod';
import { hourlySchema } from './hourly.js';

export const MARINE_HOURLY_VARIABLES = [
  'wave_height',
  'wave_period',
  'wave_direction',
  'swell_wave_height',
  'swell_wave_period',
] as const;

export type MarineHourlyVariable = (typeof MARINE_HOURLY_VARIABLES)[number];

export const marineResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: hourlySchema(MARINE_HOURLY_VARIABLES, 1),
});

export type MarineResponse = z.output<typeof marineResponseSchema>;
