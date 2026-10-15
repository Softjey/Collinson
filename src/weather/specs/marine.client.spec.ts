import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../../shared/open-meteo/open-meteo.errors.js';
import type { OpenMeteoService } from '../../shared/open-meteo/open-meteo.service.js';
import { MarineMapper } from '../mappers/marine.mapper.js';
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
  return { client: new MarineClient(service, new MarineMapper()), calls };
}

const location = { latE2: 4138, lonE2: 221, timezone: 'Europe/Madrid' };

describe('MarineClient', () => {
  it('requests the 5 hourly variables for 8 days, nearest sea cell, unix time', async () => {
    const { client, calls } = clientReturning(fixture('marine-barcelona'));

    await client.fetch(location);

    expect(calls).toEqual([
      {
        latitude: 41.38,
        longitude: 2.21,
        forecast_days: 8,
        timezone: 'Europe/Madrid',
        timeformat: 'unixtime',
        cell_selection: 'sea',
        hourly: 'wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period',
      },
    ]);
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

      await expect(new MarineClient(service, new MarineMapper()).fetch(location)).rejects.toBe(error);
    });
  });
});
