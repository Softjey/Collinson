import { ScoreScale } from '../../src/scoring/entities/score-scale.js';
import type { ActivityScorer } from '../../src/scoring/entities/activity-scorers.js';
import { FormulaScorer } from '../../src/scoring/entities/activity-scorers.js';
import type { DayConditions, DayOutcome } from '../../src/scoring/entities/day-features.js';
import type { FeatureName } from '../../src/scoring/entities/day-features.js';
import { FeatureValuesMapper } from '../../src/scoring/mappers/feature-values.mapper.js';

export function curveOf(scorer: FormulaScorer, feature: FeatureName): (x: number) => number {
  const { factors, multipliers = [] } = scorer.spec;
  const entry = [...factors, ...multipliers].find((candidate) => candidate.feature === feature);
  if (!entry) throw new Error(`${scorer.activity} has no curve for ${feature}`);
  return (x) => entry.utility.valueAt(x);
}

export const withoutCaps = (scorer: FormulaScorer): FormulaScorer =>
  new FormulaScorer({ ...scorer.spec, caps: [] });

const featureValuesMapper = new FeatureValuesMapper();

export const scoreDay = (scorer: ActivityScorer, day: DayConditions): DayOutcome =>
  scorer.score(featureValuesMapper.toFeatureValues(day));

export function scoreOf(scorer: ActivityScorer, day: DayConditions): number {
  const outcome = scoreDay(scorer, day);
  if (outcome.kind !== 'scored') throw new Error(`Expected a score, got ${outcome.reason}`);
  return outcome.score;
}

const scoreScale = new ScoreScale();

export const rate = (score: number) => scoreScale.rate(score);
