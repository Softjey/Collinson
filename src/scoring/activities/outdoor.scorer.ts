import { Injectable } from '@nestjs/common';
import type { ActivityScorer, DataSource, DayContext, DayOutcome } from '../activity-scorer.js';
import { scored, unscored } from '../activity-scorer.js';
import type { Activity } from '../activity.js';
import type { WeatherDayFeatures } from '../daily-features.js';
import { clamp, stepLookup } from '../math.js';
import { OUTDOOR_PARAMS } from '../scoring.params.js';

export function humidex(temperature: number, relativeHumidity: number): number {
  const vapourPressure =
    6.112 * 10 ** ((7.5 * temperature) / (237.7 + temperature)) * (relativeHumidity / 100);
  return temperature + (5 / 9) * (vapourPressure - 10);
}

export const thermalComfortRating = (humidexValue: number): number =>
  stepLookup(OUTDOOR_PARAMS.humidexRating, humidexValue);

export const cloudRating = (cloudCover: number): number => stepLookup(OUTDOOR_PARAMS.cloudRating, cloudCover);

export const precipitationRating = (precipitation: number): number =>
  stepLookup(OUTDOOR_PARAMS.precipitationRating, precipitation);

export const windRating = (meanWind: number): number => stepLookup(OUTDOOR_PARAMS.windRating, meanWind);

export function holidayClimateIndex(features: WeatherDayFeatures): number | null {
  const { tMax, rhMean, cloud, precip, windMean } = features;
  if (tMax === null || rhMean === null || cloud === null || precip === null || windMean === null) return null;

  const { weights, hciMax } = OUTDOOR_PARAMS;
  const hci =
    weights.thermalComfort * thermalComfortRating(humidex(tMax, rhMean)) +
    weights.cloud * cloudRating(cloud) +
    weights.precipitation * precipitationRating(precip) +
    weights.wind * windRating(windMean);
  return clamp(hci / hciMax);
}

export function outdoorScore(features: WeatherDayFeatures): number | null {
  const index = holidayClimateIndex(features);
  const { precip, windMax } = features;
  if (index === null || precip === null || windMax === null) return null;

  const { wet, storm } = OUTDOOR_PARAMS.caps;
  let score = index;
  if (precip >= wet.precipitationFrom) score = Math.min(score, wet.maxScore);
  if (windMax >= storm.windMaxFrom || precip >= storm.precipitationFrom)
    score = Math.min(score, storm.maxScore);
  return score;
}

@Injectable()
export class OutdoorSightseeingScorer implements ActivityScorer {
  readonly activity: Activity = 'OUTDOOR_SIGHTSEEING';
  readonly requiredSources: readonly DataSource[] = ['WEATHER'];

  evaluate(day: DayContext): DayOutcome {
    const score = day.weather ? outdoorScore(day.weather) : null;
    return score === null ? unscored('NO_DATA') : scored(score);
  }
}
