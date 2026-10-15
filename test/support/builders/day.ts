import type { DayContext } from '../../../src/scoring/entities/definition.types.js';
import type { MarineDayFeatures, WeatherDayFeatures } from '../../../src/scoring/utils/daily-features.js';

export const NO_WEATHER: DayContext = { weather: null, marine: null };

/** A dry, mild day with light wind: the neutral starting point that tests bend with overrides. */
export function buildWeatherFeatures(overrides: Partial<WeatherDayFeatures> = {}): WeatherDayFeatures {
  return {
    tMax: 22,
    rhMean: 50,
    precip: 0,
    rain: 0,
    snowfallSum: 0,
    snowDepthMax: 0,
    snowHours: 0,
    cloud: 20,
    windMean: 15,
    windMax: 20,
    ...overrides,
  };
}

export function buildMarine(
  overrides: Partial<MarineDayFeatures> = {},
  hasSea = true,
): NonNullable<DayContext['marine']> {
  return { hasSea, features: { waveHeight: 1.5, wavePeriod: 13, ...overrides } };
}

export const withWeather = (overrides: Partial<WeatherDayFeatures> = {}): DayContext => ({
  weather: buildWeatherFeatures(overrides),
  marine: null,
});

export const withWeatherAndSea = (
  weatherOverrides: Partial<WeatherDayFeatures> = {},
  marineOverrides: Partial<MarineDayFeatures> = {},
): DayContext => ({ weather: buildWeatherFeatures(weatherOverrides), marine: buildMarine(marineOverrides) });
