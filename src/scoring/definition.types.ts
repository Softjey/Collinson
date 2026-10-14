import type { Activity } from './activity.js';
import type { CurveSpec } from './curves.js';
import type { MarineDayFeatures, WeatherDayFeatures } from './daily-features.js';
import type { CombinerSpec } from './combiners.js';
import type { DerivedSpec } from './derived-features.js';

export type DataSource = 'WEATHER' | 'WAVES';

export type UnscoredReason = 'NO_SEA' | 'NO_SNOW' | 'NO_DATA';

export type DayOutcome = { kind: 'scored'; score: number } | { kind: 'unscored'; reason: UnscoredReason };

export interface DayContext {
  weather: WeatherDayFeatures | null;
  marine: { hasSea: boolean; features: MarineDayFeatures | null } | null;
}

export type Condition =
  | { missing: readonly string[] }
  | { feature: string; is: 'eq' | 'gte'; value: number }
  | { all: readonly Condition[] }
  | { any: readonly Condition[] };

export interface Gate {
  reason: UnscoredReason;
  when: Condition;
}

export interface Factor {
  feature: string;
  curve: CurveSpec;
  weight: number;
}

export interface Multiplier {
  feature: string;
  curve: CurveSpec;
}

export interface Cap {
  when: Condition;
  max: number;
}

export interface FormulaDefinition {
  name: Activity;
  sources: readonly DataSource[];
  derived?: Readonly<Record<string, DerivedSpec>>;
  gates: readonly Gate[];
  factors: readonly Factor[];
  combiner: CombinerSpec;
  multipliers?: readonly Multiplier[];
  caps?: readonly Cap[];
}

export interface InvertedDefinition {
  name: Activity;
  basedOn: ActivityDefinition;
  base: number;
  share: number;
}

export type ActivityDefinition = FormulaDefinition | InvertedDefinition;
