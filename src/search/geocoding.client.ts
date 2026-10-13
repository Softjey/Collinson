import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import type { Place } from './place.js';

export interface GeocodingQuery {
  name: string;
  count: number;
  language: string;
  countryCode?: string;
}

const resultSchema = z.object({
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

const responseSchema = z.object({ results: z.array(resultSchema).optional() });

@Injectable()
export class GeocodingClient {
  constructor(private readonly openMeteo: OpenMeteoService) {}

  async search({ name, count, language, countryCode }: GeocodingQuery): Promise<Place[]> {
    const body = await this.openMeteo.geocoding({ name, count, language, countryCode });
    const { results = [] } = responseSchema.parse(body);

    return results.map((result) => ({
      id: String(result.id),
      name: result.name,
      country: result.country ?? null,
      countryCode: result.country_code ?? null,
      admin1: result.admin1 ?? null,
      latitude: result.latitude,
      longitude: result.longitude,
      elevation: result.elevation ?? null,
      timezone: result.timezone ?? null,
      population: result.population ?? null,
    }));
  }
}
