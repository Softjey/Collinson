import type { OpenMeteoHttpClient, QueryParams } from '../../src/shared/open-meteo/open-meteo-http.client.js';

type Responder = (params: QueryParams) => unknown | Promise<unknown>;

export interface RecordedCall {
  url: string;
  params: QueryParams;
}

/**
 * Scripted stand-in for OpenMeteoHttpClient: the only seam e2e tests replace.
 * A response is a value, or a function that returns a value or throws.
 */
export class FakeOpenMeteoClient implements Pick<OpenMeteoHttpClient, 'get'> {
  readonly calls: RecordedCall[] = [];
  private readonly responders = new Map<string, Responder>();

  respond(url: string, response: unknown | Responder): this {
    this.responders.set(url, typeof response === 'function' ? (response as Responder) : () => response);
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.responders.clear();
  }

  async get(url: string, params: QueryParams): Promise<unknown> {
    this.calls.push({ url, params });
    const responder = this.responders.get(url);
    if (!responder) {
      throw new Error(`FakeOpenMeteoClient: no response scripted for ${url}`);
    }
    return responder(params);
  }
}
