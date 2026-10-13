import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../../shared/open-meteo/open-meteo.errors.js';
import type { OpenMeteoService } from '../../shared/open-meteo/open-meteo.service.js';
import { ForecastClient, FORECAST_PARSER_VERSION } from '.././forecast.client.js';

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
  it('starts the parser version at 1', () => {
    expect(FORECAST_PARSER_VERSION).toBe(1);
  });

  it('requests the 10 hourly variables for 8 days with unix time', async () => {
    const { client, calls } = clientReturning(fixture());

    await client.fetch(location);

    expect(calls).toEqual([
      {
        latitude: 41.4,
        longitude: 2.18,
        forecast_days: 8,
        timezone: 'Europe/Madrid',
        timeformat: 'unixtime',
        hourly:
          'temperature_2m,relative_humidity_2m,precipitation,rain,snowfall,snow_depth,cloud_cover,' +
          'wind_speed_10m,wind_gusts_10m,weather_code',
      },
    ]);
  });

  it('maps 192 hours to rows with UTC instants', async () => {
    const { client } = clientReturning(fixture());

    const data = await client.fetch(location);

    expect(data.hours).toHaveLength(192);
    expect(data.hours[0]?.timeUtc).toEqual(new Date('2026-10-12T22:00:00Z'));
    expect(data.hours[191]?.timeUtc).toEqual(new Date('2026-10-20T21:00:00Z'));
    expect(data.hours[1]).toMatchObject({ relativeHumidity2m: 63, weatherCode: 1 });
  });

  it('maps the grid point, elevation and offset', async () => {
    const { client } = clientReturning(fixture());

    const data = await client.fetch(location);

    expect(data).toMatchObject({
      apiLatitude: 41.4,
      apiLongitude: 2.18,
      elevationM: 12,
      utcOffsetSeconds: 7200,
    });
  });

  it('keeps nulls as null', async () => {
    const { client } = clientReturning(fixture());

    const data = await client.fetch(location);

    expect(data.hours[5]?.temperature2m).toBeNull();
    expect(data.hours[191]?.snowDepth).toBeNull();
    expect(data.hours[4]?.temperature2m).not.toBeNull();
  });

  it('maps a missing elevation to null', async () => {
    const response = fixture();
    delete response.elevation;
    const { client } = clientReturning(response);

    await expect(client.fetch(location)).resolves.toMatchObject({ elevationM: null });
  });

  describe('malformed responses', () => {
    it('rejects a response without hourly', async () => {
      const response = fixture();
      delete (response as Record<string, unknown>).hourly;
      const { client } = clientReturning(response);

      await expect(client.fetch(location)).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('rejects arrays of different lengths', async () => {
      const response = fixture();
      response.hourly.rain = (response.hourly.rain ?? []).slice(0, 100);
      const { client } = clientReturning(response);

      await expect(client.fetch(location)).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('rejects wrong value types', async () => {
      const response = fixture();
      response.hourly.temperature_2m = (response.hourly.temperature_2m ?? []).map((_, i) =>
        i === 3 ? 'warm' : 1,
      );
      const { client } = clientReturning(response);

      await expect(client.fetch(location)).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('rejects a body that is not an object', async () => {
      const { client } = clientReturning('<html>');

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
        forecast: async () => {
          throw error;
        },
      } as unknown as OpenMeteoService;

      await expect(new ForecastClient(service).fetch(location)).rejects.toBe(error);
    });
  });
});
