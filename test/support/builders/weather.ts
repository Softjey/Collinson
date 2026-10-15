import type {
  ForecastData,
  ForecastHour,
  LocationRef,
  MarineData,
  MarineHour,
} from '../../../src/weather/entities/weather.types.js';

export const FIRST_HOUR_UTC = Date.UTC(2026, 9, 12, 22);
const HOUR_MS = 3_600_000;
const hourAt = (index: number) => new Date(FIRST_HOUR_UTC + index * HOUR_MS);

export const BARCELONA = { latE2: 4140, lonE2: 218, timezone: 'Europe/Madrid' } as const;

export function buildLocationRef(overrides: Partial<LocationRef> = {}): LocationRef {
  return { id: 1, ...BARCELONA, ...overrides };
}

export function buildForecastData(overrides: Partial<ForecastData> = {}, hourCount = 192): ForecastData {
  const hours: ForecastHour[] = Array.from({ length: hourCount }, (_, index) => ({
    timeUtc: hourAt(index),
    temperature2m: index === 5 ? null : 15 + (index % 10),
    relativeHumidity2m: 60,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    snowDepth: 0,
    cloudCover: 40,
    windSpeed10m: 9.5,
    windGusts10m: 18,
    weatherCode: 3,
  }));
  return {
    apiLatitude: 41.4,
    apiLongitude: 2.18,
    elevationM: 12,
    utcOffsetSeconds: 7200,
    hours,
    ...overrides,
  };
}

export function buildMarineData(overrides: Partial<MarineData> = {}, hourCount = 24): MarineData {
  const hours: MarineHour[] = Array.from({ length: hourCount }, (_, index) => ({
    timeUtc: hourAt(index),
    waveHeight: 1.25,
    wavePeriod: index === 2 ? null : 8,
    waveDirection: 120,
    swellWaveHeight: 0.5,
    swellWavePeriod: 9,
  }));
  return { hasSea: true, apiLatitude: 41.375, apiLongitude: 2.208, hours, ...overrides };
}
