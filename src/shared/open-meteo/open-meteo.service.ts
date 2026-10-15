import type { z } from 'zod';
import { OpenMeteoUnavailableError } from './open-meteo.errors.js';
import type { QueryParams } from './open-meteo-http.client.js';
import {
  FORECAST_HOURLY_VARIABLES,
  forecastResponseSchema,
  type ForecastResponse,
} from './schemas/forecast.schema.js';
import { geocodingResponseSchema, type GeocodingResponse } from './schemas/geocoding.schema.js';
import {
  MARINE_HOURLY_VARIABLES,
  marineResponseSchema,
  type MarineResponse,
} from './schemas/marine.schema.js';

const FORECAST_DAYS = 8;

export interface PointRequest {
  latitude: number;
  longitude: number;
  timezone: string;
}

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

  async forecast({ latitude, longitude, timezone }: PointRequest): Promise<ForecastResponse> {
    const body = await this.endpointClients.forecast.get({
      latitude,
      longitude,
      timezone,
      forecast_days: FORECAST_DAYS,
      timeformat: 'unixtime',
      hourly: FORECAST_HOURLY_VARIABLES.join(','),
    });
    return validated(forecastResponseSchema, body);
  }

  async marine({ latitude, longitude, timezone }: PointRequest): Promise<MarineResponse> {
    const body = await this.endpointClients.marine.get({
      latitude,
      longitude,
      timezone,
      forecast_days: FORECAST_DAYS,
      timeformat: 'unixtime',
      cell_selection: 'sea',
      hourly: MARINE_HOURLY_VARIABLES.join(','),
    });
    return validated(marineResponseSchema, body);
  }

  async geocoding(params: QueryParams): Promise<GeocodingResponse> {
    return validated(geocodingResponseSchema, await this.endpointClients.geocoding.get(params));
  }
}
