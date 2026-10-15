import { jest } from '@jest/globals';
import { OpenMeteoUnavailableError } from '../open-meteo.errors.js';
import { OpenMeteoService } from '../open-meteo.service.js';

const forecastBody = {
  latitude: 1,
  longitude: 2,
  elevation: 10,
  utc_offset_seconds: 3600,
  hourly: {
    time: [0, 3600],
    temperature_2m: [1, null],
    relative_humidity_2m: [1, 2],
    precipitation: [1, 2],
    rain: [1, 2],
    snowfall: [1, 2],
    snow_depth: [1, 2],
    cloud_cover: [1, 2],
    wind_speed_10m: [1, 2],
    wind_gusts_10m: [1, 2],
    weather_code: [1, 2],
  },
};

const marineBody = {
  latitude: 1,
  longitude: 2,
  hourly: {
    time: [0],
    wave_height: [1],
    wave_period: [2],
    wave_direction: [3],
    swell_wave_height: [null],
    swell_wave_period: [null],
  },
};

const geocodingBody = { results: [{ id: 1, name: 'Rome', latitude: 41.9, longitude: 12.5 }] };

function createService() {
  const clients = {
    forecast: { get: jest.fn<(p: object) => Promise<unknown>>().mockResolvedValue(forecastBody) },
    marine: { get: jest.fn<(p: object) => Promise<unknown>>().mockResolvedValue(marineBody) },
    geocoding: { get: jest.fn<(p: object) => Promise<unknown>>().mockResolvedValue(geocodingBody) },
  };
  return { clients, service: new OpenMeteoService(clients) };
}

describe('OpenMeteoService', () => {
  it('sends forecast requests only to the forecast endpoint and returns the parsed body', async () => {
    const { clients, service } = createService();

    await expect(service.forecast({ latitude: 1 })).resolves.toEqual(forecastBody);

    expect(clients.forecast.get).toHaveBeenCalledWith({ latitude: 1 });
    expect(clients.marine.get).not.toHaveBeenCalled();
    expect(clients.geocoding.get).not.toHaveBeenCalled();
  });

  it('sends marine requests only to the marine endpoint', async () => {
    const { clients, service } = createService();

    await expect(service.marine({ latitude: 2 })).resolves.toEqual(marineBody);

    expect(clients.marine.get).toHaveBeenCalledWith({ latitude: 2 });
    expect(clients.forecast.get).not.toHaveBeenCalled();
  });

  it('sends geocoding requests only to the geocoding endpoint', async () => {
    const { clients, service } = createService();

    await expect(service.geocoding({ name: 'Rome' })).resolves.toEqual({
      results: [
        {
          id: 1,
          name: 'Rome',
          latitude: 41.9,
          longitude: 12.5,
          elevation: null,
          country: null,
          countryCode: null,
          admin1: null,
          timezone: null,
          population: null,
        },
      ],
    });

    expect(clients.geocoding.get).toHaveBeenCalledWith({ name: 'Rome' });
    expect(clients.forecast.get).not.toHaveBeenCalled();
  });

  it('maps a full geocoding result to camelCase', async () => {
    const { clients, service } = createService();
    clients.geocoding.get.mockResolvedValue({
      results: [
        {
          id: 3080165,
          name: 'Zakopane',
          latitude: 49.3,
          longitude: 19.9,
          elevation: 838,
          country: 'Poland',
          country_code: 'PL',
          admin1: 'Lesser Poland',
          timezone: 'Europe/Warsaw',
          population: 27266,
        },
      ],
    });

    await expect(service.geocoding({ name: 'Zakopane' })).resolves.toEqual({
      results: [
        {
          id: 3080165,
          name: 'Zakopane',
          latitude: 49.3,
          longitude: 19.9,
          elevation: 838,
          country: 'Poland',
          countryCode: 'PL',
          admin1: 'Lesser Poland',
          timezone: 'Europe/Warsaw',
          population: 27266,
        },
      ],
    });
  });

  it('treats a geocoding response without results as an empty list', async () => {
    const { clients, service } = createService();
    clients.geocoding.get.mockResolvedValue({ generationtime_ms: 1 });

    await expect(service.geocoding({ name: 'Nowhere' })).resolves.toEqual({ results: [] });
  });

  it('passes transport errors through unchanged', async () => {
    const { clients, service } = createService();
    const failure = new Error('down');
    clients.forecast.get.mockRejectedValue(failure);

    await expect(service.forecast({})).rejects.toBe(failure);
  });

  describe('malformed responses are reported as unavailable', () => {
    it('forecast without hourly', async () => {
      const { clients, service } = createService();
      clients.forecast.get.mockResolvedValue({ ...forecastBody, hourly: undefined });

      await expect(service.forecast({})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('forecast with hourly arrays of different lengths', async () => {
      const { clients, service } = createService();
      clients.forecast.get.mockResolvedValue({
        ...forecastBody,
        hourly: { ...forecastBody.hourly, rain: [1] },
      });

      await expect(service.forecast({})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('forecast with wrong value types', async () => {
      const { clients, service } = createService();
      clients.forecast.get.mockResolvedValue({
        ...forecastBody,
        hourly: { ...forecastBody.hourly, temperature_2m: ['warm', 1] },
      });

      await expect(service.forecast({})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('marine with an empty time axis', async () => {
      const { clients, service } = createService();
      clients.marine.get.mockResolvedValue({
        ...marineBody,
        hourly: {
          ...marineBody.hourly,
          time: [],
          wave_height: [],
          wave_period: [],
          wave_direction: [],
          swell_wave_height: [],
          swell_wave_period: [],
        },
      });

      await expect(service.marine({})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });

    it('geocoding results missing required fields', async () => {
      const { clients, service } = createService();
      clients.geocoding.get.mockResolvedValue({ results: [{ id: 1 }] });

      await expect(service.geocoding({})).rejects.toBeInstanceOf(OpenMeteoUnavailableError);
    });
  });
});
