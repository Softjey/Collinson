import { compileCurve } from '../curves.js';
import type { ActivityDefinition, DayContext, FormulaDefinition } from '../definition.types.js';
import type { WeatherDayFeatures } from '../daily-features.js';
import { scoreDay } from '../score-day.js';

export const NO_WEATHER: DayContext = { weather: null, marine: null };

export const withWeather = (weather: WeatherDayFeatures): DayContext => ({ weather, marine: null });

export function curveOf(definition: FormulaDefinition, feature: string): (x: number) => number {
  const entry = [...definition.factors, ...(definition.multipliers ?? [])].find(
    (candidate) => candidate.feature === feature,
  );
  if (!entry) throw new Error(`${definition.name} has no curve for ${feature}`);
  return compileCurve(entry.curve);
}

export const withoutCaps = (definition: FormulaDefinition): FormulaDefinition => ({
  ...definition,
  caps: [],
});

export function scoreOf(definition: ActivityDefinition, day: DayContext): number {
  const outcome = scoreDay(definition, day);
  if (outcome.kind !== 'scored') throw new Error(`Expected a score, got ${outcome.reason}`);
  return outcome.score;
}
