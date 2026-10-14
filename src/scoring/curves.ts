import { clamp, interpolate, stepLookup, type Anchor, type Step } from './math.js';

interface CurveKinds {
  piecewise: { anchors: readonly Anchor[] };
  steps: { steps: readonly Step<number>[] };
  polynomial: { coefficients: readonly number[]; divisor: number; zeroAbove?: number };
  peakNormalizedGev: { shape: number; location: number; scale: number };
}

export type CurveSpec = { [K in keyof CurveKinds]: { kind: K } & CurveKinds[K] }[keyof CurveKinds];

type CurveFunction = (x: number) => number;

const CURVE_KINDS: { [K in keyof CurveKinds]: (params: CurveKinds[K]) => CurveFunction } = {
  piecewise:
    ({ anchors }) =>
    (x) =>
      interpolate(anchors, x),

  steps:
    ({ steps }) =>
    (x) =>
      stepLookup(steps, x),

  polynomial:
    ({ coefficients, divisor, zeroAbove }) =>
    (x) => {
      if (zeroAbove !== undefined && x > zeroAbove) return 0;
      const value = coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0);
      return clamp(value / divisor);
    },

  peakNormalizedGev: ({ shape, location, scale }) => {
    const density = (x: number): number => {
      const g = 1 - (shape * (x - location)) / scale;
      if (g <= 0) return 0;
      return (1 / scale) * g ** (1 / shape - 1) * Math.exp(-(g ** (1 / shape)));
    };
    const upperLimit = location + scale / shape;
    let peak = 0;
    for (let x = -60; x < upperLimit; x += 0.001) peak = Math.max(peak, density(x));
    return (x) => density(x) / peak;
  },
};

const compiled = new WeakMap<CurveSpec, CurveFunction>();

export function compileCurve(spec: CurveSpec): CurveFunction {
  let curve = compiled.get(spec);
  if (!curve) {
    const build = CURVE_KINDS[spec.kind] as ((params: CurveSpec) => CurveFunction) | undefined;
    if (!build) throw new Error(`Unknown curve kind ${spec.kind}`);
    curve = build(spec);
    compiled.set(spec, curve);
  }
  return curve;
}
