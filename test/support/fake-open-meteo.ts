import type { QueryParams } from '../../src/shared/open-meteo/open-meteo-http.client.js';
import type { OpenMeteoApi } from '../../src/shared/open-meteo/open-meteo.service.js';

export type Endpoint = keyof OpenMeteoApi;

type Responder = (params: QueryParams) => unknown | Promise<unknown>;

export interface RecordedCall {
  endpoint: Endpoint;
  params: QueryParams;
}

/**
 * Scripted stand-in for OpenMeteoService: the only seam e2e tests replace.
 * A response is a value, or a function that returns a value or throws.
 */
export class FakeOpenMeteo implements OpenMeteoApi {
  readonly calls: RecordedCall[] = [];
  private readonly responders = new Map<Endpoint, Responder>();

  respond(endpoint: Endpoint, response: unknown | Responder): this {
    this.responders.set(endpoint, typeof response === 'function' ? (response as Responder) : () => response);
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.responders.clear();
  }

  forecast(params: QueryParams): Promise<unknown> {
    return this.call('forecast', params);
  }

  marine(params: QueryParams): Promise<unknown> {
    return this.call('marine', params);
  }

  geocoding(params: QueryParams): Promise<unknown> {
    return this.call('geocoding', params);
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
