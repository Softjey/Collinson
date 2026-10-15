import { clamp } from '../utils/math.js';
import type { DerivedFeatureName, FeatureName, FeatureValues } from './day-features.js';

const isMissing = (value: number | null | undefined): boolean => value === null || value === undefined;

/** A yes/no question about a day's feature values. A value that is missing never satisfies a comparison. */
export abstract class Condition {
  abstract holdsFor(features: FeatureValues): boolean;

  static anyMissing(...names: FeatureName[]): Condition {
    return new AnyMissing(names);
  }

  static equals(name: FeatureName, expected: number): Condition {
    return new Comparison(name, (value) => value === expected);
  }

  static atLeast(name: FeatureName, minimum: number): Condition {
    return new Comparison(name, (value) => value >= minimum);
  }

  static allOf(...conditions: Condition[]): Condition {
    return new AllOf(conditions);
  }

  static anyOf(...conditions: Condition[]): Condition {
    return new AnyOf(conditions);
  }
}

class AnyMissing extends Condition {
  constructor(private readonly names: readonly FeatureName[]) {
    super();
  }

  holdsFor(features: FeatureValues): boolean {
    return this.names.some((name) => isMissing(features[name]));
  }
}

class Comparison extends Condition {
  constructor(
    private readonly name: FeatureName,
    private readonly isSatisfiedBy: (value: number) => boolean,
  ) {
    super();
  }

  holdsFor(features: FeatureValues): boolean {
    const value = features[this.name];
    return value !== null && value !== undefined && this.isSatisfiedBy(value);
  }
}

class AllOf extends Condition {
  constructor(private readonly conditions: readonly Condition[]) {
    super();
  }

  holdsFor(features: FeatureValues): boolean {
    return this.conditions.every((condition) => condition.holdsFor(features));
  }
}

class AnyOf extends Condition {
  constructor(private readonly conditions: readonly Condition[]) {
    super();
  }

  holdsFor(features: FeatureValues): boolean {
    return this.conditions.some((condition) => condition.holdsFor(features));
  }
}

export interface WeightedUtility {
  utility: number;
  weight: number;
}

/** Merges the weighted utilities of the factors of an activity into one score between 0 and 1. */
export abstract class Combiner {
  abstract combine(terms: readonly WeightedUtility[]): number;

  /** Adds weight * utility, divides by `divisor` and clamps to 0..1. */
  static weightedSum(options: { divisor?: number } = {}): Combiner {
    return new WeightedSum(options.divisor ?? 1);
  }

  /** Multiplies utility ^ weight, so one useless factor makes the whole score 0. */
  static weightedProduct(): Combiner {
    return new WeightedProduct();
  }
}

class WeightedSum extends Combiner {
  constructor(private readonly divisor: number) {
    super();
  }

  combine(terms: readonly WeightedUtility[]): number {
    const total = terms.reduce((sum, { utility, weight }) => sum + weight * utility, 0);
    return clamp(total / this.divisor);
  }
}

class WeightedProduct extends Combiner {
  combine(terms: readonly WeightedUtility[]): number {
    return clamp(terms.reduce((product, { utility, weight }) => product * utility ** weight, 1));
  }
}

/** A feature computed from other features of the same day. It is missing when any of its inputs is. */
export abstract class DerivedFeature {
  protected abstract readonly inputs: readonly FeatureName[];

  protected abstract calculate(inputValues: number[]): number;

  computeFrom(features: FeatureValues): number | null {
    const inputValues: number[] = [];
    for (const name of this.inputs) {
      const value = features[name];
      if (value === null || value === undefined) return null;
      inputValues.push(value);
    }
    return this.calculate(inputValues);
  }

  /** The Canadian humidex: how hot the air feels from its temperature and relative humidity. */
  static humidex(options: { temperature: FeatureName; relativeHumidity: FeatureName }): DerivedFeature {
    return new Humidex(options.temperature, options.relativeHumidity);
  }

  static quotient(options: { of: FeatureName; dividedBy: number }): DerivedFeature {
    return new Quotient(options.of, options.dividedBy);
  }
}

export class Humidex extends DerivedFeature {
  protected readonly inputs: readonly FeatureName[];

  constructor(temperature: FeatureName, relativeHumidity: FeatureName) {
    super();
    this.inputs = [temperature, relativeHumidity];
  }

  protected calculate([temperature, relativeHumidity]: number[]): number {
    const vapourPressure =
      6.112 * 10 ** ((7.5 * temperature) / (237.7 + temperature)) * (relativeHumidity / 100);
    return temperature + (5 / 9) * (vapourPressure - 10);
  }
}

export class Quotient extends DerivedFeature {
  protected readonly inputs: readonly FeatureName[];

  constructor(
    dividend: FeatureName,
    private readonly divisor: number,
  ) {
    super();
    this.inputs = [dividend];
  }

  protected calculate([dividend]: number[]): number {
    return dividend / this.divisor;
  }
}

export type DerivedFeatures = Partial<Record<DerivedFeatureName, DerivedFeature>>;
