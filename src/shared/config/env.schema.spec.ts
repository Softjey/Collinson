import { parseEnv } from './env.schema.js';

const minimal = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('parseEnv', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    expect(parseEnv(minimal)).toEqual({
      port: 3000,
      databaseUrl: 'postgresql://u:p@localhost:5432/db',
      openMeteo: {
        forecastUrl: 'https://api.open-meteo.com/v1/forecast',
        marineUrl: 'https://marine-api.open-meteo.com/v1/marine',
        geocodingUrl: 'https://geocoding-api.open-meteo.com/v1/search',
        apiKey: undefined,
        timeoutMs: 10_000,
        retries: 1,
      },
      weatherRefreshHours: 6,
      wavesRefreshHours: 24,
      maxStaleHours: 48,
      placeSearchCacheDays: 30,
      otel: { enabled: false, endpoint: 'http://localhost:4318' },
    });
  });

  it('coerces numeric strings to numbers', () => {
    const config = parseEnv({
      ...minimal,
      PORT: '8080',
      OPEN_METEO_TIMEOUT_MS: '2500',
      OPEN_METEO_RETRIES: '3',
      WEATHER_REFRESH_HOURS: '12',
    });

    expect(config.port).toBe(8080);
    expect(config.openMeteo.timeoutMs).toBe(2500);
    expect(config.openMeteo.retries).toBe(3);
    expect(config.weatherRefreshHours).toBe(12);
  });

  it('accepts zero retries', () => {
    expect(parseEnv({ ...minimal, OPEN_METEO_RETRIES: '0' }).openMeteo.retries).toBe(0);
  });

  it('reads the API key and custom base URLs', () => {
    const config = parseEnv({
      ...minimal,
      OPEN_METEO_API_KEY: 'secret',
      OPEN_METEO_FORECAST_URL: 'https://customer-api.open-meteo.com/v1/forecast',
    });

    expect(config.openMeteo.apiKey).toBe('secret');
    expect(config.openMeteo.forecastUrl).toBe('https://customer-api.open-meteo.com/v1/forecast');
  });

  it('parses the OpenTelemetry flag', () => {
    expect(parseEnv({ ...minimal, OTEL_ENABLED: 'true' }).otel.enabled).toBe(true);
    expect(parseEnv({ ...minimal, OTEL_ENABLED: 'false' }).otel.enabled).toBe(false);
  });

  it('fails when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['OPEN_METEO_TIMEOUT_MS', 'abc'],
    ['OPEN_METEO_TIMEOUT_MS', '-5'],
    ['OPEN_METEO_TIMEOUT_MS', '0'],
    ['OPEN_METEO_RETRIES', '-1'],
    ['WEATHER_REFRESH_HOURS', '0'],
    ['WAVES_REFRESH_HOURS', '-1'],
    ['MAX_STALE_HOURS', 'soon'],
    ['PLACE_SEARCH_CACHE_DAYS', '0'],
    ['PORT', '70000'],
  ])('fails when %s is %s', (name, value) => {
    expect(() => parseEnv({ ...minimal, [name]: value })).toThrow(new RegExp(name));
  });

  it.each(['OPEN_METEO_FORECAST_URL', 'OPEN_METEO_MARINE_URL', 'OPEN_METEO_GEOCODING_URL'])(
    'fails when %s is not a URL',
    (name) => {
      expect(() => parseEnv({ ...minimal, [name]: 'not a url' })).toThrow(new RegExp(name));
    },
  );

  it('fails when OTEL_ENABLED is not a boolean', () => {
    expect(() => parseEnv({ ...minimal, OTEL_ENABLED: 'yes' })).toThrow(/OTEL_ENABLED/);
  });

  it('lists every invalid variable in one error', () => {
    const run = () => parseEnv({ PORT: 'x', OPEN_METEO_RETRIES: '-1' });

    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/PORT/);
    expect(run).toThrow(/OPEN_METEO_RETRIES/);
  });
});
