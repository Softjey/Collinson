import { Injectable } from '@nestjs/common';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import type { Place } from './entities/place.js';
import type { SearchLocationsArgs } from './entities/search-locations.args.js';

@Injectable()
export class GeocodingClient {
  constructor(private readonly openMeteo: OpenMeteoService) {}

  async search({ name, count, language, countryCode }: SearchLocationsArgs): Promise<Place[]> {
    const { results } = await this.openMeteo.geocoding({
      name,
      count,
      language,
      countryCode: countryCode ?? undefined,
    });

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
