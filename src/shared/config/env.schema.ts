import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();
const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  OPEN_METEO_FORECAST_URL: z.url().default('https://api.open-meteo.com/v1/forecast'),
  OPEN_METEO_MARINE_URL: z.url().default('https://marine-api.open-meteo.com/v1/marine'),
  OPEN_METEO_GEOCODING_URL: z.url().default('https://geocoding-api.open-meteo.com/v1/search'),
  OPEN_METEO_API_KEY: z.string().min(1).optional(),
  OPEN_METEO_TIMEOUT_MS: positiveInt.default(10_000),
  OPEN_METEO_RETRIES: nonNegativeInt.default(1),
  WEATHER_REFRESH_HOURS: positiveInt.default(6),
  WAVES_REFRESH_HOURS: positiveInt.default(24),
  MAX_STALE_HOURS: positiveInt.default(48),
  PLACE_SEARCH_CACHE_DAYS: positiveInt.default(30),
  OTEL_ENABLED: booleanString.default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default('http://localhost:4318'),
});

export interface AppConfig {
  port: number;
  databaseUrl: string;
  openMeteo: {
    forecastUrl: string;
    marineUrl: string;
    geocodingUrl: string;
    apiKey: string | undefined;
    timeoutMs: number;
    retries: number;
  };
  weatherRefreshHours: number;
  wavesRefreshHours: number;
  maxStaleHours: number;
  placeSearchCacheDays: number;
  otel: { enabled: boolean; endpoint: string };
}

export function parseEnv(env: Record<string, string | undefined>): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(env)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  const e = result.data;
  return {
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    openMeteo: {
      forecastUrl: e.OPEN_METEO_FORECAST_URL,
      marineUrl: e.OPEN_METEO_MARINE_URL,
      geocodingUrl: e.OPEN_METEO_GEOCODING_URL,
      apiKey: e.OPEN_METEO_API_KEY,
      timeoutMs: e.OPEN_METEO_TIMEOUT_MS,
      retries: e.OPEN_METEO_RETRIES,
    },
    weatherRefreshHours: e.WEATHER_REFRESH_HOURS,
    wavesRefreshHours: e.WAVES_REFRESH_HOURS,
    maxStaleHours: e.MAX_STALE_HOURS,
    placeSearchCacheDays: e.PLACE_SEARCH_CACHE_DAYS,
    otel: { enabled: e.OTEL_ENABLED, endpoint: e.OTEL_EXPORTER_OTLP_ENDPOINT },
  };
}
