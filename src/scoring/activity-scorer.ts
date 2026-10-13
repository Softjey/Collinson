import type { Activity } from './activity.js';
import type { MarineDayFeatures, WeatherDayFeatures } from './daily-features.js';

export type DataSource = 'WEATHER' | 'WAVES';

export type UnscoredReason = 'NO_SEA' | 'NO_SNOW' | 'NO_DATA';

export type DayOutcome = { kind: 'scored'; score: number } | { kind: 'unscored'; reason: UnscoredReason };

export interface DayContext {
  weather: WeatherDayFeatures | null;
  marine: { hasSea: boolean; features: MarineDayFeatures | null } | null;
}

export interface ActivityScorer {
  readonly activity: Activity;
  readonly requiredSources: readonly DataSource[];
  evaluate(day: DayContext): DayOutcome;
}

export const ACTIVITY_SCORERS = Symbol('ACTIVITY_SCORERS');

export const scored = (score: number): DayOutcome => ({ kind: 'scored', score });

export const unscored = (reason: UnscoredReason): DayOutcome => ({ kind: 'unscored', reason });
