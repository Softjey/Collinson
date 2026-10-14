import { z } from 'zod';
import { hasEqualLengths, hourlyValues } from './hourly.js';

export const marineResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: z
    .object({
      time: z.array(z.number().int()).min(1),
      wave_height: hourlyValues,
      wave_period: hourlyValues,
      wave_direction: hourlyValues,
      swell_wave_height: hourlyValues,
      swell_wave_period: hourlyValues,
    })
    .refine(hasEqualLengths, { message: 'hourly arrays must have the same length' }),
});

export type MarineResponse = z.output<typeof marineResponseSchema>;
