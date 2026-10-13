import { HttpService } from '@nestjs/axios';
import type { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { retry } from '../retry.js';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from './open-meteo.errors.js';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface OpenMeteoHttpOptions {
  baseUrl: string;
  retries: number;
  apiKey: string | undefined;
}

export class OpenMeteoHttpClient {
  constructor(
    private readonly http: HttpService,
    private readonly options: OpenMeteoHttpOptions,
  ) {}

  get(params: QueryParams): Promise<unknown> {
    return retry(() => this.request(params), {
      retries: this.options.retries,
      shouldRetry: (error) => error instanceof OpenMeteoUnavailableError,
    });
  }

  private async request(params: QueryParams): Promise<unknown> {
    const response = await this.send(params);
    return bodyOrThrow(response);
  }

  private async send(params: QueryParams): Promise<AxiosResponse> {
    try {
      return await firstValueFrom(
        this.http.get(this.options.baseUrl, {
          params: { ...params, apikey: this.options.apiKey },
          validateStatus: () => true,
        }),
      );
    } catch (cause) {
      throw new OpenMeteoUnavailableError('Open-Meteo request failed', { cause });
    }
  }
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
