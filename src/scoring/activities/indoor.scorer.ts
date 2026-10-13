import { Injectable } from '@nestjs/common';
import type { ActivityScorer, DataSource, DayContext, DayOutcome } from '../activity-scorer.js';
import { scored, unscored } from '../activity-scorer.js';
import type { Activity } from '../activity.js';
import type { WeatherDayFeatures } from '../daily-features.js';
import { INDOOR_PARAMS } from '../scoring.params.js';
import { outdoorScore } from './outdoor.scorer.js';

export function indoorScore(features: WeatherDayFeatures): number | null {
  const outdoor = outdoorScore(features);
  if (outdoor === null) return null;
  return INDOOR_PARAMS.base + INDOOR_PARAMS.outdoorShare * (1 - outdoor);
}

@Injectable()
export class IndoorSightseeingScorer implements ActivityScorer {
  readonly activity: Activity = 'INDOOR_SIGHTSEEING';
  readonly requiredSources: readonly DataSource[] = ['WEATHER'];

  evaluate(day: DayContext): DayOutcome {
    const score = day.weather ? indoorScore(day.weather) : null;
    return score === null ? unscored('NO_DATA') : scored(score);
  }
}
