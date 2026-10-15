import { z } from 'zod';

const geocodingResultSchema = z
  .object({
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
  })
  .transform(({ country_code, ...result }) => ({
    id: result.id,
    name: result.name,
    country: result.country ?? null,
    countryCode: country_code ?? null,
    admin1: result.admin1 ?? null,
    latitude: result.latitude,
    longitude: result.longitude,
    elevation: result.elevation ?? null,
    timezone: result.timezone ?? null,
    population: result.population ?? null,
  }));

export const geocodingResponseSchema = z.object({ results: z.array(geocodingResultSchema).default([]) });

export type GeocodingResponse = z.output<typeof geocodingResponseSchema>;
export type GeocodingResult = GeocodingResponse['results'][number];
