import { jest } from '@jest/globals';
import { OpenMeteoHttpClient, type FetchFn } from './open-meteo-http.client.js';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from './open-meteo.errors.js';

const URL_BASE = 'https://api.open-meteo.com/v1/forecast';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function timeoutError(): Error {
  return new DOMException('The operation was aborted due to timeout', 'TimeoutError');
}

function createClient(fetchFn: FetchFn, options: { retries?: number; apiKey?: string } = {}) {
  return new OpenMeteoHttpClient(
    { timeoutMs: 1000, retries: options.retries ?? 1, apiKey: options.apiKey },
    fetchFn,
  );
}

describe('OpenMeteoHttpClient', () => {
  it('returns the parsed JSON body on success', async () => {
    const fetchFn = jest.fn<FetchFn>().mockResolvedValue(jsonResponse({ hourly: { time: [1] } }));

    const result = await createClient(fetchFn).get(URL_BASE, { latitude: 41.85 });

    expect(result).toEqual({ hourly: { time: [1] } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sends the parameters as a query string and skips undefined ones', async () => {
    const fetchFn = jest.fn<FetchFn>().mockResolvedValue(jsonResponse({}));

    await createClient(fetchFn).get(URL_BASE, {
      latitude: 41.85,
      longitude: 12.5,
      hourly: 'temperature_2m,rain',
      cell_selection: undefined,
      past_days: 0,
    });

    const calledUrl = new URL(String(fetchFn.mock.calls[0][0]));
    expect(calledUrl.origin + calledUrl.pathname).toBe(URL_BASE);
    expect(Object.fromEntries(calledUrl.searchParams)).toEqual({
      latitude: '41.85',
      longitude: '12.5',
      hourly: 'temperature_2m,rain',
      past_days: '0',
    });
  });

  it('passes a timeout signal to fetch', async () => {
    const fetchFn = jest.fn<FetchFn>().mockResolvedValue(jsonResponse({}));

    await createClient(fetchFn).get(URL_BASE, {});

    expect(fetchFn.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  describe('retries', () => {
    it('retries once after a timeout and fails as unavailable when it times out again', async () => {
      const fetchFn = jest.fn<FetchFn>().mockRejectedValue(timeoutError());

      await expect(createClient(fetchFn).get(URL_BASE, {})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('retries once after a 5xx and fails as unavailable when it fails again', async () => {
      const fetchFn = jest.fn<FetchFn>().mockResolvedValue(jsonResponse({ error: true }, 503));

      await expect(createClient(fetchFn).get(URL_BASE, {})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('retries a network error', async () => {
      const fetchFn = jest
        .fn<FetchFn>()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(jsonResponse({ ok: 1 }));

      const result = await createClient(fetchFn).get(URL_BASE, {});

      expect(result).toEqual({ ok: 1 });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('returns the data when the retry succeeds after a 500', async () => {
      const fetchFn = jest
        .fn<FetchFn>()
        .mockResolvedValueOnce(jsonResponse({ error: true }, 500))
        .mockResolvedValueOnce(jsonResponse({ ok: 2 }));

      await expect(createClient(fetchFn).get(URL_BASE, {})).resolves.toEqual({ ok: 2 });
    });

    it('does not retry when retries is 0', async () => {
      const fetchFn = jest.fn<FetchFn>().mockResolvedValue(jsonResponse({}, 500));

      await expect(createClient(fetchFn, { retries: 0 }).get(URL_BASE, {})).rejects.toBeInstanceOf(
        OpenMeteoUnavailableError,
      );
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('retries as many times as configured', async () => {
      const fetchFn = jest.fn<FetchFn>().mockResolvedValue(jsonResponse({}, 502));

      await expect(createClient(fetchFn, { retries: 3 }).get(URL_BASE, {})).rejects.toBeInstanceOf(
        OpenMeteoUnavailableError,
      );
      expect(fetchFn).toHaveBeenCalledTimes(4);
    });
  });

  describe('client errors', () => {
    it('does not retry a 429 and reports it as rate limited', async () => {
      const fetchFn = jest
        .fn<FetchFn>()
        .mockResolvedValue(jsonResponse({ error: true, reason: 'limit' }, 429));

      await expect(createClient(fetchFn).get(URL_BASE, {})).rejects.toBeInstanceOf(OpenMeteoRateLimitedError);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 400 and keeps the reason', async () => {
      const fetchFn = jest
        .fn<FetchFn>()
        .mockResolvedValue(
          jsonResponse({ error: true, reason: 'Latitude must be in range of -90 to 90' }, 400),
        );

      const error = await createClient(fetchFn)
        .get(URL_BASE, {})
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OpenMeteoBadRequestError);
      expect((error as OpenMeteoBadRequestError).reason).toBe('Latitude must be in range of -90 to 90');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('reports another 4xx without a JSON body as a bad request', async () => {
      const fetchFn = jest.fn<FetchFn>().mockResolvedValue(new Response('Not Found', { status: 404 }));

      const error = await createClient(fetchFn)
        .get(URL_BASE, {})
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OpenMeteoBadRequestError);
      expect((error as OpenMeteoBadRequestError).reason).toContain('404');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  it('reports an invalid JSON body as unavailable', async () => {
    const fetchFn = jest.fn<FetchFn>().mockResolvedValue(new Response('<html>oops</html>', { status: 200 }));

    await expect(createClient(fetchFn).get(URL_BASE, {})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
  });

  describe('API key', () => {
    it('is absent from the query when not configured', async () => {
      const fetchFn = jest.fn<FetchFn>().mockResolvedValue(jsonResponse({}));

      await createClient(fetchFn).get(URL_BASE, { latitude: 1 });

      expect(new URL(String(fetchFn.mock.calls[0][0])).searchParams.has('apikey')).toBe(false);
    });

    it('is sent as the apikey parameter when configured', async () => {
      const fetchFn = jest.fn<FetchFn>().mockResolvedValue(jsonResponse({}));

      await createClient(fetchFn, { apiKey: 'secret' }).get(URL_BASE, { latitude: 1 });

      expect(new URL(String(fetchFn.mock.calls[0][0])).searchParams.get('apikey')).toBe('secret');
    });
  });
});
