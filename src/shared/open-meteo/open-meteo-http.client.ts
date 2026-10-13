import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from './open-meteo.errors.js';

export type FetchFn = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface OpenMeteoHttpOptions {
  timeoutMs: number;
  retries: number;
  apiKey: string | undefined;
}

export class OpenMeteoHttpClient {
  constructor(
    private readonly options: OpenMeteoHttpOptions,
    private readonly fetchFn: FetchFn,
  ) {}

  async get(baseUrl: string, params: QueryParams): Promise<unknown> {
    const url = this.buildUrl(baseUrl, params);
    let lastError: OpenMeteoUnavailableError | undefined;

    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        return await this.attempt(url);
      } catch (error) {
        if (!(error instanceof RetryableFailure)) {
          throw error;
        }
        lastError = error.unavailable;
      }
    }
    throw lastError;
  }

  private buildUrl(baseUrl: string, params: QueryParams): URL {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    if (this.options.apiKey) {
      url.searchParams.set('apikey', this.options.apiKey);
    }
    return url;
  }

  private async attempt(url: URL): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(url, { signal: AbortSignal.timeout(this.options.timeoutMs) });
    } catch (cause) {
      throw new RetryableFailure(new OpenMeteoUnavailableError('Open-Meteo request failed', { cause }));
    }

    if (response.status === 429) {
      throw new OpenMeteoRateLimitedError();
    }
    if (response.status >= 500) {
      throw new RetryableFailure(
        new OpenMeteoUnavailableError(`Open-Meteo responded with HTTP ${response.status}`),
      );
    }
    if (response.status >= 400) {
      throw new OpenMeteoBadRequestError(await this.readReason(response));
    }

    try {
      return await response.json();
    } catch (cause) {
      throw new OpenMeteoUnavailableError('Open-Meteo returned a body that is not valid JSON', { cause });
    }
  }

  private async readReason(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { reason?: unknown };
      if (typeof body.reason === 'string') {
        return body.reason;
      }
    } catch {
      // the body is not JSON; fall back to the status
    }
    return `HTTP ${response.status}`;
  }
}

class RetryableFailure extends Error {
  constructor(readonly unavailable: OpenMeteoUnavailableError) {
    super(unavailable.message);
  }
}
