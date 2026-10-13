import type { QueryParams } from './open-meteo-http.client.js';

export interface OpenMeteoApi {
  forecast(params: QueryParams): Promise<unknown>;
  marine(params: QueryParams): Promise<unknown>;
  geocoding(params: QueryParams): Promise<unknown>;
}

interface EndpointClient {
  get(params: QueryParams): Promise<unknown>;
}

export class OpenMeteoService implements OpenMeteoApi {
  constructor(
    private readonly clients: { forecast: EndpointClient; marine: EndpointClient; geocoding: EndpointClient },
  ) {}

  forecast(params: QueryParams): Promise<unknown> {
    return this.clients.forecast.get(params);
  }

  marine(params: QueryParams): Promise<unknown> {
    return this.clients.marine.get(params);
  }

  geocoding(params: QueryParams): Promise<unknown> {
    return this.clients.geocoding.get(params);
  }
}
