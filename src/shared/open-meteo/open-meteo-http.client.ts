import { HttpService } from '@nestjs/axios';
import type { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Metrics } from '../observability/metrics.js';
import { retry } from '../retry.js';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from './open-meteo.errors.js';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export type OpenMeteoSource = 'forecast' | 'marine' | 'geocoding';

const OUTCOMES_BY_ERROR = [
  [OpenMeteoRateLimitedError, 'rate_limited'],
  [OpenMeteoBadRequestError, 'bad_request'],
  [OpenMeteoUnavailableError, 'unavailable'],
] as const;

export interface OpenMeteoHttpOptions {
  source: OpenMeteoSource;
  baseUrl: string;
  retries: number;
  apiKey: string | undefined;
  metrics: Metrics;
}

export class OpenMeteoHttpClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly openMeteoHttpOptions: OpenMeteoHttpOptions,
  ) {}

  get(params: QueryParams): Promise<unknown> {
    return retry(() => this.request(params), {
      retries: this.openMeteoHttpOptions.retries,
      shouldRetry: (error) => error instanceof OpenMeteoUnavailableError,
    });
  }

  private async request(params: QueryParams): Promise<unknown> {
    const startedAt = performance.now();
    let outcome = 'ok';
    try {
      return bodyOrThrow(await this.send(params));
    } catch (error) {
      outcome = outcomeOf(error);
      throw error;
    } finally {
      const labels = { source: this.openMeteoHttpOptions.source };
      this.openMeteoHttpOptions.metrics.increment('openMeteoRequest', { ...labels, outcome });
      this.openMeteoHttpOptions.metrics.observe(
        'openMeteoRequestDurationMs',
        performance.now() - startedAt,
        labels,
      );
    }
  }

  private async send(params: QueryParams): Promise<AxiosResponse> {
    try {
      return await firstValueFrom(
        this.httpService.get(this.openMeteoHttpOptions.baseUrl, {
          params: { ...params, apikey: this.openMeteoHttpOptions.apiKey },
          validateStatus: () => true,
        }),
      );
    } catch (cause) {
      throw new OpenMeteoUnavailableError('Open-Meteo request failed', { cause });
    }
  }
}

function outcomeOf(error: unknown): string {
  return OUTCOMES_BY_ERROR.find(([errorType]) => error instanceof errorType)?.[1] ?? 'unavailable';
}

function bodyOrThrow({ status, data }: AxiosResponse): unknown {
  if (status === 429) {
    throw new OpenMeteoRateLimitedError();
  }
  if (status >= 500) {
    throw new OpenMeteoUnavailableError(`Open-Meteo responded with HTTP ${status}`);
  }
  if (status >= 400) {
    throw new OpenMeteoBadRequestError(reasonOf(data) ?? `HTTP ${status}`);
  }
  if (typeof data !== 'object' || data === null) {
    throw new OpenMeteoUnavailableError('Open-Meteo returned a body that is not valid JSON');
  }
  return data;
}

function reasonOf(data: unknown): string | undefined {
  const reason = (data as { reason?: unknown } | null)?.reason;
  return typeof reason === 'string' ? reason : undefined;
}
