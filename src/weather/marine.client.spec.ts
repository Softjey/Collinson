import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../shared/open-meteo/open-meteo.errors.js';
import type { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import { MarineClient, MARINE_PARSER_VERSION } from './marine.client.js';

function fixture(name: string): Record<string, unknown> & { hourly: Record<string, unknown[]> } {
  const path = fileURLToPath(new URL(`../../test/fixtures/weather/${name}.json`, import.meta.url));
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
  it('starts the parser version at 1', () => {
    expect(MARINE_PARSER_VERSION).toBe(1);
  });

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

  it('maps a coastal response to hasSea with 192 hours', async () => {
    const { client } = clientReturning(fixture('marine-barcelona'));

    const data = await client.fetch(location);

    expect(data.hasSea).toBe(true);
    expect(data.apiLatitude).toBe(41.375);
    expect(data.apiLongitude).toBe(2.208);
    expect(data.hours).toHaveLength(192);
    expect(data.hours[0]?.timeUtc).toEqual(new Date('2026-10-12T22:00:00Z'));
    expect(data.hours[0]).toMatchObject({ waveHeight: 0.6, waveDirection: 120 });
  });

  it('keeps nulls in individual hours', async () => {
    const { client } = clientReturning(fixture('marine-barcelona'));

    const data = await client.fetch(location);

    expect(data.hours[10]?.wavePeriod).toBeNull();
    expect(data.hours[10]?.waveHeight).not.toBeNull();
  });

  it('maps an all-null wave height to no sea and no hours', async () => {
    const { client } = clientReturning(fixture('marine-madrid-inland'));

    const data = await client.fetch(location);

    expect(data.hasSea).toBe(false);
    expect(data.hours).toEqual([]);
  });

  it('keeps hasSea when only some wave heights are null', async () => {
    const response = fixture('marine-barcelona');
    response.hourly.wave_height = (response.hourly.wave_height ?? []).map((value, i) => (i === 0 ? value : null));
    const { client } = clientReturning(response);

    const data = await client.fetch(location);

    expect(data.hasSea).toBe(true);
    expect(data.hours).toHaveLength(192);
  });

  describe('malformed responses', () => {
    it('rejects a response without hourly', async () => {
      const response = fixture('marine-barcelona');
      delete (response as Record<string, unknown>).hourly;
      const { client } = clientReturning(response);

      await expect(client.fetch(location)).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('rejects arrays of different lengths', async () => {
      const response = fixture('marine-barcelona');
      response.hourly.swell_wave_period = (response.hourly.swell_wave_period ?? []).slice(0, 5);
      const { client } = clientReturning(response);

      await expect(client.fetch(location)).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('rejects wrong value types', async () => {
      const response = fixture('marine-barcelona');
      response.hourly.wave_height = (response.hourly.wave_height ?? []).map((_, i) => (i === 0 ? '1.2' : 1));
      const { client } = clientReturning(response);

      await expect(client.fetch(location)).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('rejects empty arrays rather than reading them as no sea', async () => {
      const response = fixture('marine-barcelona');
      for (const key of Object.keys(response.hourly)) {
        response.hourly[key] = [];
      }
      const { client } = clientReturning(response);

      await expect(client.fetch(location)).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });
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
