import { clamp } from './math.js';

export interface WeightedValue {
  value: number;
  weight: number;
}

interface CombinerKinds {
  weightedSum: { divisor?: number };
  geometric: object;
}

export type CombinerSpec = {
  [K in keyof CombinerKinds]: { kind: K } & CombinerKinds[K];
}[keyof CombinerKinds];

const COMBINER_KINDS: {
  [K in keyof CombinerKinds]: (terms: readonly WeightedValue[], params: CombinerKinds[K]) => number;
} = {
  weightedSum: (terms, { divisor = 1 }) =>
    clamp(terms.reduce((sum, { value, weight }) => sum + weight * value, 0) / divisor),
  geometric: (terms) => clamp(terms.reduce((product, { value, weight }) => product * value ** weight, 1)),
};

export function combine(spec: CombinerSpec, terms: readonly WeightedValue[]): number {
  const combiner = COMBINER_KINDS[spec.kind] as
    ((terms: readonly WeightedValue[], params: CombinerSpec) => number) | undefined;
  if (!combiner) throw new Error(`Unknown combiner kind ${spec.kind}`);
  return combiner(terms, spec);
}
