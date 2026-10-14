import { jest } from '@jest/globals';
import { HttpService } from '@nestjs/axios';
import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { OpenMeteoHttpClient } from '../open-meteo-http.client.js';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../open-meteo.errors.js';

function reply(status: number, data: unknown) {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
    status,
    statusText: '',
    data,
    headers: {},
    config,
  });
}

function createClient(adapter: AxiosAdapter, options: { retries?: number; apiKey?: string } = {}) {
  const http = new HttpService(axios.create({ adapter, timeout: 1000 }));
  return new OpenMeteoHttpClient(http, {
    baseUrl: 'https://open-meteo.test/v1',
    retries: options.retries ?? 1,
    apiKey: options.apiKey,
  });
}

function queryOf(adapter: jest.Mock<AxiosAdapter>): Record<string, string> {
  const config = adapter.mock.calls[0][0];
  return Object.fromEntries(new URL(axios.getUri(config)).searchParams);
}

const networkError = () => new AxiosError('Network Error', AxiosError.ERR_NETWORK);
const timeoutError = () => new AxiosError('timeout of 1000ms exceeded', AxiosError.ECONNABORTED);

describe('OpenMeteoHttpClient', () => {
  it('returns the JSON body on success', async () => {
    const adapter = jest.fn<AxiosAdapter>(reply(200, { hourly: { time: [1] } }));

    await expect(createClient(adapter).get({ latitude: 41.85 })).resolves.toEqual({ hourly: { time: [1] } });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('sends the parameters as a query string and skips undefined ones', async () => {
    const adapter = jest.fn<AxiosAdapter>(reply(200, {}));

    await createClient(adapter).get({
      latitude: 41.85,
      hourly: 'temperature_2m,rain',
      cell_selection: undefined,
      past_days: 0,
    });

    expect(queryOf(adapter)).toEqual({ latitude: '41.85', hourly: 'temperature_2m,rain', past_days: '0' });
  });

  describe('retries', () => {
    it('retries once after a timeout and then fails as unavailable', async () => {
      const adapter = jest.fn<AxiosAdapter>().mockRejectedValue(timeoutError());

      await expect(createClient(adapter).get({})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
      expect(adapter).toHaveBeenCalledTimes(2);
    });

    it('retries once after a 5xx and then fails as unavailable', async () => {
      const adapter = jest.fn<AxiosAdapter>(reply(503, { error: true }));

      await expect(createClient(adapter).get({})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
      expect(adapter).toHaveBeenCalledTimes(2);
    });

    it('retries a network error and returns the data when the retry succeeds', async () => {
      const adapter = jest
        .fn<AxiosAdapter>()
        .mockRejectedValueOnce(networkError())
        .mockImplementationOnce(reply(200, { ok: 1 }));

      await expect(createClient(adapter).get({})).resolves.toEqual({ ok: 1 });
      expect(adapter).toHaveBeenCalledTimes(2);
    });

    it('returns the data when the retry succeeds after a 500', async () => {
      const adapter = jest
        .fn<AxiosAdapter>()
        .mockImplementationOnce(reply(500, { error: true }))
        .mockImplementationOnce(reply(200, { ok: 2 }));

      await expect(createClient(adapter).get({})).resolves.toEqual({ ok: 2 });
    });

    it('does not retry when retries is 0', async () => {
      const adapter = jest.fn<AxiosAdapter>(reply(500, {}));

      await expect(createClient(adapter, { retries: 0 }).get({})).rejects.toBeInstanceOf(
        OpenMeteoUnavailableError,
      );
      expect(adapter).toHaveBeenCalledTimes(1);
    });

    it('retries as many times as configured', async () => {
      const adapter = jest.fn<AxiosAdapter>(reply(502, {}));

      await expect(createClient(adapter, { retries: 3 }).get({})).rejects.toBeInstanceOf(
        OpenMeteoUnavailableError,
      );
      expect(adapter).toHaveBeenCalledTimes(4);
    });
  });

  describe('client errors', () => {
    it('does not retry a 429 and reports it as rate limited', async () => {
      const adapter = jest.fn<AxiosAdapter>(reply(429, { error: true, reason: 'limit' }));

      await expect(createClient(adapter).get({})).rejects.toBeInstanceOf(OpenMeteoRateLimitedError);
      expect(adapter).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 400 and keeps the reason', async () => {
      const adapter = jest.fn<AxiosAdapter>(
        reply(400, { error: true, reason: 'Latitude must be in range of -90 to 90' }),
      );

      const error = await createClient(adapter)
        .get({})
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OpenMeteoBadRequestError);
      expect((error as OpenMeteoBadRequestError).reason).toBe('Latitude must be in range of -90 to 90');
      expect(adapter).toHaveBeenCalledTimes(1);
    });

    it('reports another 4xx without a JSON body as a bad request with the status', async () => {
      const adapter = jest.fn<AxiosAdapter>(reply(404, 'Not Found'));

      const error = await createClient(adapter)
        .get({})
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OpenMeteoBadRequestError);
      expect((error as OpenMeteoBadRequestError).reason).toContain('404');
      expect(adapter).toHaveBeenCalledTimes(1);
    });
  });

  it('reports a body that is not JSON as unavailable', async () => {
    const adapter = jest.fn<AxiosAdapter>(reply(200, '<html>oops</html>'));

    await expect(createClient(adapter).get({})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
  });

  describe('API key', () => {
    it('is absent from the query when not configured', async () => {
      const adapter = jest.fn<AxiosAdapter>(reply(200, {}));

      await createClient(adapter).get({ latitude: 1 });

      expect(queryOf(adapter)).not.toHaveProperty('apikey');
    });

    it('is sent as the apikey parameter when configured', async () => {
      const adapter = jest.fn<AxiosAdapter>(reply(200, {}));

      await createClient(adapter, { apiKey: 'secret' }).get({ latitude: 1 });

      expect(queryOf(adapter).apikey).toBe('secret');
    });
  });
});
