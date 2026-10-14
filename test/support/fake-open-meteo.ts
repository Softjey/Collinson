import type { QueryParams } from '../../src/shared/open-meteo/open-meteo-http.client.js';
import { OpenMeteoService } from '../../src/shared/open-meteo/open-meteo.service.js';

export type Endpoint = 'forecast' | 'marine' | 'geocoding';

type Responder = (params: QueryParams) => unknown | Promise<unknown>;

export interface RecordedCall {
  endpoint: Endpoint;
  params: QueryParams;
}

/**
 * OpenMeteoService with scripted HTTP endpoints: the only seam e2e tests replace, so response
 * validation still runs. A response is a value, or a function that returns a value or throws.
 */
export class FakeOpenMeteo extends OpenMeteoService {
  readonly calls: RecordedCall[] = [];
  private readonly responders = new Map<Endpoint, Responder>();

  constructor() {
    const endpoint = (name: Endpoint) => ({ get: (params: QueryParams) => this.call(name, params) });
    super({ forecast: endpoint('forecast'), marine: endpoint('marine'), geocoding: endpoint('geocoding') });
  }

  respond(endpoint: Endpoint, response: unknown | Responder): this {
    this.responders.set(endpoint, typeof response === 'function' ? (response as Responder) : () => response);
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.responders.clear();
  }

  private async call(endpoint: Endpoint, params: QueryParams): Promise<unknown> {
    this.calls.push({ endpoint, params });
    const responder = this.responders.get(endpoint);
    if (!responder) {
      throw new Error(`FakeOpenMeteo: no response scripted for ${endpoint}`);
    }
    return responder(params);
  }
}
