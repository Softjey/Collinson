import { Injectable } from '@nestjs/common';
import type { ActivityScorer, DataSource, DayContext, DayOutcome } from '../activity-scorer.js';
import { scored, unscored } from '../activity-scorer.js';
import type { Activity } from '../activity.js';
import type { WeatherDayFeatures } from '../daily-features.js';
import { clamp } from '../math.js';
import { SKIING_PARAMS } from '../scoring.params.js';

const cubic = (x: number, { c0, c1, c2, c3 }: { c0: number; c1: number; c2: number; c3: number }) =>
  c0 + c1 * x + c2 * x ** 2 + c3 * x ** 3;

export function snowUtility(snowHours: number): number {
  if (snowHours > SKIING_PARAMS.maxSnowHours) return 0;
  const { divisor, ...coefficients } = SKIING_PARAMS.snowPolynomial;
  return clamp(cubic(snowHours, coefficients) / divisor);
}

export function windUtility(windMeanKmh: number): number {
  const { divisor, ...coefficients } = SKIING_PARAMS.windPolynomial;
  return clamp(cubic(windMeanKmh / SKIING_PARAMS.kmhPerMs, coefficients) / divisor);
}

function temperatureDensity(temperature: number): number {
  const { c, loc, s } = SKIING_PARAMS.temperature;
  const g = 1 - (c * (temperature - loc)) / s;
  if (g <= 0) return 0;
  return (1 / s) * g ** (1 / c - 1) * Math.exp(-(g ** (1 / c)));
}

function findPeakDensity(): number {
  const { c, loc, s } = SKIING_PARAMS.temperature;
  const upperLimit = loc + s / c;
  let peak = 0;
  for (let t = -60; t < upperLimit; t += 0.001) {
    peak = Math.max(peak, temperatureDensity(t));
  }
  return peak;
}

const PEAK_DENSITY = findPeakDensity();

export const temperatureUtility = (tMax: number): number => temperatureDensity(tMax) / PEAK_DENSITY;

export const cloudUtility = (cloud: number): number => clamp((100 - cloud) / SKIING_PARAMS.cloudRange);

export const rainMultiplier = (rain: number): number => clamp(1 - rain / SKIING_PARAMS.rainZeroAt);

export const depthMultiplier = (snowDepthMax: number): number => Math.min(1, snowDepthMax / SKIING_PARAMS.fullDepthAt);

export function skiingOutcome(features: WeatherDayFeatures): DayOutcome {
  const { tMax, cloud, windMean, rain, snowfallSum, snowDepthMax, snowHours } = features;
  if (
    tMax === null ||
    cloud === null ||
    windMean === null ||
    rain === null ||
    snowfallSum === null ||
    snowDepthMax === null ||
    snowHours === null
  ) {
    return unscored('NO_DATA');
  }
  if (snowDepthMax === 0 && snowfallSum === 0) return unscored('NO_SNOW');

  const { weights } = SKIING_PARAMS;
  const index =
    weights.snow * snowUtility(snowHours) +
    weights.wind * windUtility(windMean) +
    weights.temperature * temperatureUtility(tMax) +
    weights.cloud * cloudUtility(cloud);
  return scored(index * rainMultiplier(rain) * depthMultiplier(snowDepthMax));
}

@Injectable()
export class SkiingScorer implements ActivityScorer {
  readonly activity: Activity = 'SKIING';
  readonly requiredSources: readonly DataSource[] = ['WEATHER'];

  evaluate(day: DayContext): DayOutcome {
    return day.weather ? skiingOutcome(day.weather) : unscored('NO_DATA');
  }
}
