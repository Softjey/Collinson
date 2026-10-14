import { z } from 'zod';

const geocodingResultSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().nullish(),
  country: z.string().nullish(),
  country_code: z.string().nullish(),
  admin1: z.string().nullish(),
  timezone: z.string().nullish(),
  population: z.number().int().nullish(),
});

export const geocodingResponseSchema = z.object({ results: z.array(geocodingResultSchema).default([]) });

export type GeocodingResponse = z.output<typeof geocodingResponseSchema>;
export type GeocodingResult = GeocodingResponse['results'][number];
