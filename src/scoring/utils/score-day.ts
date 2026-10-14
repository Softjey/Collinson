import { combine } from './combiners.js';
import { compileCurve } from './curves.js';
import type {
  DayContext,
  ActivityDefinition,
  Condition,
  DayOutcome,
  FormulaDefinition,
} from '../entities/definition.types.js';
import { computeDerived, type FeatureValues } from './derived-features.js';

const scored = (score: number): DayOutcome => ({ kind: 'scored', score });

function toFeatureValues({ weather, marine }: DayContext): FeatureValues {
  return {
    ...weather,
    ...marine?.features,
    ...(marine ? { hasSea: marine.hasSea ? 1 : 0 } : {}),
  };
}

const isMissing = (value: number | null | undefined): boolean => value === null || value === undefined;

function holds(condition: Condition, features: FeatureValues): boolean {
  if ('missing' in condition) return condition.missing.some((name) => isMissing(features[name]));
  if ('all' in condition) return condition.all.every((inner) => holds(inner, features));
  if ('any' in condition) return condition.any.some((inner) => holds(inner, features));

  const value = features[condition.feature];
  if (value === null || value === undefined) return false;
  return condition.is === 'eq' ? value === condition.value : value >= condition.value;
}

function scoreFormula(definition: FormulaDefinition, base: FeatureValues): DayOutcome {
  for (const { reason, when } of definition.gates) {
    if (holds(when, base)) return { kind: 'unscored', reason };
  }

  const features: Record<string, number | null | undefined> = { ...base };
  for (const [name, spec] of Object.entries(definition.derived ?? {})) {
    features[name] = computeDerived(spec, features);
  }

  const read = (name: string): number => {
    const value = features[name];
    if (value === null || value === undefined) {
      throw new Error(`${definition.name} reads ${name} without gating its absence`);
    }
    return value;
  };

  let score = combine(
    definition.combiner,
    definition.factors.map(({ feature, curve, weight }) => ({
      value: compileCurve(curve)(read(feature)),
      weight,
    })),
  );
  for (const { feature, curve } of definition.multipliers ?? []) {
    score *= compileCurve(curve)(read(feature));
  }
  for (const { when, max } of definition.caps ?? []) {
    if (holds(when, features)) score = Math.min(score, max);
  }
  return scored(score);
}

function scoreFeatures(definition: ActivityDefinition, features: FeatureValues): DayOutcome {
  if (!('basedOn' in definition)) return scoreFormula(definition, features);

  const outcome = scoreFeatures(definition.basedOn, features);
  if (outcome.kind === 'unscored') return outcome;
  return scored(definition.base + definition.share * (1 - outcome.score));
}

export const scoreDay = (definition: ActivityDefinition, day: DayContext): DayOutcome =>
  scoreFeatures(definition, toFeatureValues(day));
