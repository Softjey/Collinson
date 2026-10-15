import { compileCurve } from '../../src/scoring/utils/curves.js';
import type {
  ActivityDefinition,
  DayContext,
  FormulaDefinition,
} from '../../src/scoring/entities/definition.types.js';
import { FeatureValuesMapper } from '../../src/scoring/mappers/feature-values.mapper.js';
import { scoreFeatures } from '../../src/scoring/utils/score-day.js';

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

const mapper = new FeatureValuesMapper();

export const scoreDay = (definition: ActivityDefinition, day: DayContext) =>
  scoreFeatures(definition, mapper.toFeatureValues(day));

export function scoreOf(definition: ActivityDefinition, day: DayContext): number {
  const outcome = scoreDay(definition, day);
  if (outcome.kind !== 'scored') throw new Error(`Expected a score, got ${outcome.reason}`);
  return outcome.score;
}
