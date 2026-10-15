import { clamp, interpolate, stepLookup, type Anchor, type Step } from '../utils/math.js';

/** Turns a measured value into a utility between 0 (useless) and 1 (ideal), or into a rating where a table says so. */
export abstract class Curve {
  abstract valueAt(x: number): number;

  /** Straight lines between the points, flat before the first and after the last. */
  static piecewiseLinear(...points: Anchor[]): Curve {
    return new PiecewiseLinearCurve(points);
  }

  /** A table of ratings: `valueBelowFirstStep` applies under the first step, each step applies from its bound upwards. */
  static stepTable(options: { valueBelowFirstStep: number; steps: [from: number, value: number][] }): Curve {
    return new StepTableCurve([
      { from: Number.NEGATIVE_INFINITY, value: options.valueBelowFirstStep },
      ...options.steps.map(([from, value]) => ({ from, value })),
    ]);
  }

  /** `coefficients[n]` multiplies x^n; the result is divided by `divisor` and clamped to 0..1. */
  static polynomial(options: { coefficients: number[]; divisor: number; zeroAbove?: number }): Curve {
    return new PolynomialCurve(options.coefficients, options.divisor, options.zeroAbove);
  }

  /** A generalised extreme value density, scaled so its highest point is 1. */
  static peakNormalizedExtremeValue(options: { shape: number; location: number; scale: number }): Curve {
    return new PeakNormalizedExtremeValueCurve(options.shape, options.location, options.scale);
  }
}

export class PiecewiseLinearCurve extends Curve {
  constructor(private readonly points: readonly Anchor[]) {
    super();
  }

  valueAt(x: number): number {
    return interpolate(this.points, x);
  }
}

export class StepTableCurve extends Curve {
  constructor(private readonly rows: readonly Step<number>[]) {
    super();
  }

  valueAt(x: number): number {
    return stepLookup(this.rows, x);
  }
}

export class PolynomialCurve extends Curve {
  constructor(
    private readonly coefficients: readonly number[],
    private readonly divisor: number,
    private readonly zeroAbove?: number,
  ) {
    super();
  }

  valueAt(x: number): number {
    if (this.zeroAbove !== undefined && x > this.zeroAbove) return 0;
    const value = this.coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0);
    return clamp(value / this.divisor);
  }
}

export class PeakNormalizedExtremeValueCurve extends Curve {
  private static readonly SEARCH_START = -60;
  private static readonly SEARCH_STEP = 0.001;
  private readonly highestDensity: number;

  constructor(
    private readonly shape: number,
    private readonly location: number,
    private readonly scale: number,
  ) {
    super();
    this.highestDensity = this.findHighestDensity();
  }

  valueAt(x: number): number {
    return this.densityAt(x) / this.highestDensity;
  }

  private densityAt(x: number): number {
    const g = 1 - (this.shape * (x - this.location)) / this.scale;
    if (g <= 0) return 0;
    return (1 / this.scale) * g ** (1 / this.shape - 1) * Math.exp(-(g ** (1 / this.shape)));
  }

  private findHighestDensity(): number {
    const upperLimit = this.location + this.scale / this.shape;
    let highest = 0;
    for (
      let x = PeakNormalizedExtremeValueCurve.SEARCH_START;
      x < upperLimit;
      x += PeakNormalizedExtremeValueCurve.SEARCH_STEP
    ) {
      highest = Math.max(highest, this.densityAt(x));
    }
    return highest;
  }
}
