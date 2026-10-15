import { interpolate, stepLookup, type Anchor, type Step } from '../utils/math.js';

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
