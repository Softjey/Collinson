import type { z } from 'zod';
import { OpenMeteoUnavailableError } from './open-meteo.errors.js';
import type { QueryParams } from './open-meteo-http.client.js';
import { forecastResponseSchema, type ForecastResponse } from './schemas/forecast.schema.js';
import { geocodingResponseSchema, type GeocodingResponse } from './schemas/geocoding.schema.js';
import { marineResponseSchema, type MarineResponse } from './schemas/marine.schema.js';

interface EndpointClient {
  get(params: QueryParams): Promise<unknown>;
}

function validated<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new OpenMeteoUnavailableError('Open-Meteo returned an unexpected response', {
      cause: result.error,
    });
  }
  return result.data;
}

export class OpenMeteoService {
  constructor(
    private readonly endpointClients: {
      forecast: EndpointClient;
      marine: EndpointClient;
      geocoding: EndpointClient;
    },
  ) {}

  async forecast(params: QueryParams): Promise<ForecastResponse> {
    return validated(forecastResponseSchema, await this.endpointClients.forecast.get(params));
  }

  async marine(params: QueryParams): Promise<MarineResponse> {
    return validated(marineResponseSchema, await this.endpointClients.marine.get(params));
  }

  async geocoding(params: QueryParams): Promise<GeocodingResponse> {
    return validated(geocodingResponseSchema, await this.endpointClients.geocoding.get(params));
  }
}
