import type {
  DayConditions,
  MarineDayFeatures,
  WeatherDayFeatures,
} from '../../../src/scoring/entities/day-features.js';

export const NO_WEATHER: DayConditions = { weather: null, marine: null };

/** A dry, mild day with light wind: the neutral starting point that tests bend with overrides. */
export function buildWeatherFeatures(overrides: Partial<WeatherDayFeatures> = {}): WeatherDayFeatures {
  return {
    maxTemperatureC: 22,
    meanRelativeHumidityPercent: 50,
    totalPrecipitationMm: 0,
    totalRainMm: 0,
    totalSnowfallCm: 0,
    maxSnowDepthM: 0,
    snowfallHours: 0,
    meanCloudCoverPercent: 20,
    meanWindSpeedKmh: 15,
    maxWindSpeedKmh: 20,
    ...overrides,
  };
}

export function buildMarine(
  overrides: Partial<MarineDayFeatures> = {},
  hasSea = true,
): NonNullable<DayConditions['marine']> {
  return { hasSea, features: { maxWaveHeightM: 1.5, maxWavePeriodS: 13, ...overrides } };
}

export const withWeather = (overrides: Partial<WeatherDayFeatures> = {}): DayConditions => ({
  weather: buildWeatherFeatures(overrides),
  marine: null,
});

export const withWeatherAndSea = (
  weatherOverrides: Partial<WeatherDayFeatures> = {},
  marineOverrides: Partial<MarineDayFeatures> = {},
): DayConditions => ({
  weather: buildWeatherFeatures(weatherOverrides),
  marine: buildMarine(marineOverrides),
});
