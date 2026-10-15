import type { Activity } from './activity.js';

export type DataSource = 'WEATHER' | 'WAVES';

export type UnscoredReason = 'NO_SEA' | 'NO_SNOW' | 'NO_DATA';

export type DayOutcome = { kind: 'scored'; score: number } | { kind: 'unscored'; reason: UnscoredReason };

export interface ActivityOutcome {
  activity: Activity;
  outcome: DayOutcome;
}

/** What one calendar day looked like, summarised from its hourly values. A value is null when no hour had data. */
export interface WeatherDayFeatures {
  maxTemperatureC: number | null;
  meanRelativeHumidityPercent: number | null;
  totalPrecipitationMm: number | null;
  totalRainMm: number | null;
  totalSnowfallCm: number | null;
  maxSnowDepthM: number | null;
  snowfallHours: number | null;
  meanCloudCoverPercent: number | null;
  meanWindSpeedKmh: number | null;
  maxWindSpeedKmh: number | null;
}

export interface MarineDayFeatures {
  maxWaveHeightM: number | null;
  maxWavePeriodS: number | null;
}

/** Everything known about one day: weather is null without usable hours, marine is null when it was not requested. */
export interface DayConditions {
  weather: WeatherDayFeatures | null;
  marine: { hasSea: boolean; features: MarineDayFeatures | null } | null;
}

export interface HourlyWeather {
  unixSeconds: number;
  temperatureC: number | null;
  relativeHumidityPercent: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  snowfallCm: number | null;
  snowDepthM: number | null;
  cloudCoverPercent: number | null;
  windSpeedKmh: number | null;
}

export interface HourlyMarine {
  unixSeconds: number;
  waveHeightM: number | null;
  wavePeriodS: number | null;
}

export type DerivedFeatureName = 'humidex' | 'meanWindSpeedMs';

export type FeatureName = keyof WeatherDayFeatures | keyof MarineDayFeatures | 'hasSea' | DerivedFeatureName;

/** The flat record formulas read from. `hasSea` is 1 or 0. */
export type FeatureValues = Readonly<Partial<Record<FeatureName, number | null>>>;
