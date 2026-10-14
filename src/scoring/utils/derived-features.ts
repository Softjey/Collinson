export type FeatureValues = Readonly<Record<string, number | null | undefined>>;

interface DerivedKinds {
  humidex: object;
  divide: { by: number };
}

export type DerivedSpec = {
  [K in keyof DerivedKinds]: { kind: K; inputs: readonly string[] } & DerivedKinds[K];
}[keyof DerivedKinds];

export function humidex(temperature: number, relativeHumidity: number): number {
  const vapourPressure =
    6.112 * 10 ** ((7.5 * temperature) / (237.7 + temperature)) * (relativeHumidity / 100);
  return temperature + (5 / 9) * (vapourPressure - 10);
}

const DERIVED_KINDS: { [K in keyof DerivedKinds]: (inputs: number[], params: DerivedKinds[K]) => number } = {
  humidex: ([temperature, relativeHumidity]) => humidex(temperature, relativeHumidity),
  divide: ([value], { by }) => value / by,
};

export function computeDerived(spec: DerivedSpec, features: FeatureValues): number | null {
  const compute = DERIVED_KINDS[spec.kind] as ((inputs: number[], params: DerivedSpec) => number) | undefined;
  if (!compute) throw new Error(`Unknown derived feature kind ${spec.kind}`);

  const inputs: number[] = [];
  for (const name of spec.inputs) {
    const value = features[name];
    if (value === null || value === undefined) return null;
    inputs.push(value);
  }
  return compute(inputs, spec);
}
