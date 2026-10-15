import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../../shared/open-meteo/open-meteo.errors.js';
import type { OpenMeteoService } from '../../shared/open-meteo/open-meteo.service.js';
import { MarineClient } from '../marine.client.js';

function fixture(name: string): Record<string, unknown> & { hourly: Record<string, unknown[]> } {
  const path = fileURLToPath(new URL(`../../../test/fixtures/weather/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

function clientReturning(response: unknown) {
  const calls: Record<string, unknown>[] = [];
  const service = {
    marine: async (params: Record<string, unknown>) => {
      calls.push(params);
      return response;
    },
  } as unknown as OpenMeteoService;
  return { client: new MarineClient(service), calls };
}

const location = { latE2: 4138, lonE2: 221, timezone: 'Europe/Madrid' };

describe('MarineClient', () => {
  it('requests the point with its coordinates in degrees and its time zone', async () => {
    const { client, calls } = clientReturning(fixture('marine-barcelona'));

    await client.fetch(location);

    expect(calls).toEqual([{ latitude: 41.38, longitude: 2.21, timezone: 'Europe/Madrid' }]);
  });

  describe('HTTP client errors', () => {
    it.each([
      ['rate limited', new OpenMeteoRateLimitedError()],
      ['bad request', new OpenMeteoBadRequestError('bad')],
      ['unavailable', new OpenMeteoUnavailableError('down')],
    ])('passes a %s error through', async (_name, error) => {
      const service = {
        marine: async () => {
          throw error;
        },
      } as unknown as OpenMeteoService;

      await expect(new MarineClient(service).fetch(location)).rejects.toBe(error);
    });
  });
});
