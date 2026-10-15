import { Injectable } from '@nestjs/common';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import type { Place } from './entities/place.js';
import type { SearchLocationsArgs } from './entities/search-locations.args.js';

@Injectable()
export class GeocodingClient {
  constructor(private readonly openMeteoService: OpenMeteoService) {}

  async search({ name, count, language, countryCode }: SearchLocationsArgs): Promise<Place[]> {
    const { results } = await this.openMeteoService.geocoding({ name, count, language, countryCode });
    return results;
  }
}
