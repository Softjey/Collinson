import type { Activity } from './activity.js';
import type { Curve } from './curves.js';
import type { DataSource, DayOutcome, FeatureName, FeatureValues, UnscoredReason } from './day-features.js';
import type { Combiner, Condition, DerivedFeatures } from './formula-parts.js';

/** Knows how to score one activity for one day. */
export abstract class ActivityScorer {
  abstract readonly activity: Activity;

  /** The data an outcome other than `NO_DATA` depends on, so only that data needs to be fetched. */
  abstract readonly requiredSources: readonly DataSource[];

  abstract score(features: FeatureValues): DayOutcome;
}

export interface UnscoredRule {
  reason: UnscoredReason;
  when: Condition;
}

/** One aspect of the day (such as wind) that counts towards the score with a weight. */
export interface Factor {
  feature: FeatureName;
  utility: Curve;
  weight: number;
}

/** Scales the score down by a utility of one feature, such as rain spoiling a ski day. */
export interface Multiplier {
  feature: FeatureName;
  utility: Curve;
}

/** Keeps the score at or under `max` whenever the condition holds. */
export interface Cap {
  when: Condition;
  max: number;
}

export interface FormulaSpec {
  activity: Activity;
  requiredSources: readonly DataSource[];
  derivedFeatures?: DerivedFeatures;
  unscoredWhen: readonly UnscoredRule[];
  factors: readonly Factor[];
  combiner: Combiner;
  multipliers?: readonly Multiplier[];
  caps?: readonly Cap[];
}

/**
 * Scores a day in four steps: decide whether it can be scored at all, combine the weighted utilities of the
 * factors, scale the result by the multipliers, then cut it down to the caps.
 */
export class FormulaScorer extends ActivityScorer {
  readonly activity: Activity;
  readonly requiredSources: readonly DataSource[];

  constructor(readonly spec: FormulaSpec) {
    super();
    this.activity = spec.activity;
    this.requiredSources = spec.requiredSources;
  }

  score(features: FeatureValues): DayOutcome {
    const reason = this.reasonToLeaveUnscored(features);
    if (reason) return { kind: 'unscored', reason };

    const known = this.withDerivedFeatures(features);
    const readValue = (name: FeatureName) => this.readRequired(known, name);

    let score = this.spec.combiner.combine(
      this.spec.factors.map(({ feature, utility, weight }) => ({
        utility: utility.valueAt(readValue(feature)),
        weight,
      })),
    );
    for (const { feature, utility } of this.spec.multipliers ?? []) {
      score *= utility.valueAt(readValue(feature));
    }
    for (const { when, max } of this.spec.caps ?? []) {
      if (when.holdsFor(known)) score = Math.min(score, max);
    }
    return { kind: 'scored', score };
  }

  private reasonToLeaveUnscored(features: FeatureValues): UnscoredReason | null {
    return this.spec.unscoredWhen.find(({ when }) => when.holdsFor(features))?.reason ?? null;
  }

  private withDerivedFeatures(features: FeatureValues): FeatureValues {
    const known: Record<string, number | null | undefined> = { ...features };
    for (const [name, derived] of Object.entries(this.spec.derivedFeatures ?? {})) {
      known[name] = derived.computeFrom(known);
    }
    return known;
  }

  private readRequired(features: FeatureValues, name: FeatureName): number {
    const value = features[name];
    if (value === null || value === undefined) {
      throw new Error(`${this.activity} reads ${name} without declaring when it is missing`);
    }
    return value;
  }
}

/** Scores as the opposite of another activity: `floor + range * (1 - the other score)`. */
export class OppositeScorer extends ActivityScorer {
  readonly activity: Activity;
  readonly requiredSources: readonly DataSource[];

  constructor(
    activity: Activity,
    private readonly opposedActivity: ActivityScorer,
    private readonly range: { floor: number; spread: number },
  ) {
    super();
    this.activity = activity;
    this.requiredSources = opposedActivity.requiredSources;
  }

  score(features: FeatureValues): DayOutcome {
    const opposed = this.opposedActivity.score(features);
    if (opposed.kind === 'unscored') return opposed;
    return { kind: 'scored', score: this.range.floor + this.range.spread * (1 - opposed.score) };
  }
}

/** The scorers available to the service, looked up by activity. */
export class ActivityCatalogue {
  constructor(private readonly scorers: readonly ActivityScorer[]) {}

  scorerFor(activity: Activity): ActivityScorer {
    const matches = this.scorers.filter((scorer) => scorer.activity === activity);
    if (matches.length === 0) throw new Error(`No scorer for ${activity}`);
    if (matches.length > 1) throw new Error(`Duplicate scorer for ${activity}`);
    return matches[0];
  }

  requiredSourcesOf(activities: readonly Activity[]): DataSource[] {
    const sources = new Set<DataSource>();
    for (const activity of activities) {
      for (const source of this.scorerFor(activity).requiredSources) sources.add(source);
    }
    return [...sources];
  }
}
