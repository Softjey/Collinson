import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../../shared/open-meteo/open-meteo.errors.js';
import type { OpenMeteoService } from '../../shared/open-meteo/open-meteo.service.js';
import { ForecastClient } from '../forecast.client.js';

function fixture(): Record<string, unknown> & { hourly: Record<string, unknown[]> } {
  const path = fileURLToPath(
    new URL('../../../test/fixtures/weather/forecast-barcelona.json', import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf8'));
}

function clientReturning(response: unknown) {
  const calls: Record<string, unknown>[] = [];
  const service = {
    forecast: async (params: Record<string, unknown>) => {
      calls.push(params);
      return response;
    },
  } as unknown as OpenMeteoService;
  return { client: new ForecastClient(service), calls };
}

const location = { latE2: 4140, lonE2: 218, timezone: 'Europe/Madrid' };

describe('ForecastClient', () => {
  it('requests the point with its coordinates in degrees and its time zone', async () => {
    const { client, calls } = clientReturning(fixture());

    await client.fetch(location);

    expect(calls).toEqual([{ latitude: 41.4, longitude: 2.18, timezone: 'Europe/Madrid' }]);
  });

  describe('HTTP client errors', () => {
    it.each([
      ['rate limited', new OpenMeteoRateLimitedError()],
      ['bad request', new OpenMeteoBadRequestError('bad')],
      ['unavailable', new OpenMeteoUnavailableError('down')],
    ])('passes a %s error through', async (_name, error) => {
      const service = {
        forecast: async () => {
          throw error;
        },
      } as unknown as OpenMeteoService;

      await expect(new ForecastClient(service).fetch(location)).rejects.toBe(error);
    });
  });
});
