import type { ActivityDefinition, DayContext, FormulaDefinition } from '../../entities/definition.types.js';
import { scoreDay } from '../score-day.js';

const day = (weather: Record<string, number | null>, marine: DayContext['marine'] = null): DayContext => ({
  weather: weather as never,
  marine,
});

const warmth = {
  kind: 'piecewise',
  anchors: [
    [0, 0],
    [10, 1],
  ],
} as const;

const formula: FormulaDefinition = {
  name: 'SKIING',
  sources: ['WEATHER'],
  gates: [{ reason: 'NO_DATA', when: { missing: ['tMax', 'rain'] } }],
  factors: [{ feature: 'tMax', curve: warmth, weight: 1 }],
  combiner: { kind: 'weightedSum' },
};

describe('scoreDay gates', () => {
  it('scores when no gate matches', () => {
    expect(scoreDay(formula, day({ tMax: 5, rain: 0 }))).toEqual({ kind: 'scored', score: 0.5 });
  });

  it('returns the reason of the first matching gate', () => {
    const gated: FormulaDefinition = {
      ...formula,
      gates: [
        { reason: 'NO_SEA', when: { feature: 'hasSea', is: 'eq', value: 0 } },
        { reason: 'NO_DATA', when: { missing: ['tMax'] } },
      ],
    };
    const noSea = { hasSea: false, features: null };

    expect(scoreDay(gated, { weather: null, marine: noSea })).toEqual({ kind: 'unscored', reason: 'NO_SEA' });
    expect(scoreDay(gated, { weather: null, marine: null })).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('treats a missing feature and a null feature alike', () => {
    expect(scoreDay(formula, day({ tMax: 5 }))).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
    expect(scoreDay(formula, day({ tMax: null, rain: 0 }))).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('never matches a comparison on a missing feature', () => {
    const gated: FormulaDefinition = {
      ...formula,
      gates: [{ reason: 'NO_SNOW', when: { feature: 'snow', is: 'eq', value: 0 } }],
    };

    expect(scoreDay(gated, day({ tMax: 5 })).kind).toBe('scored');
  });

  it('supports all and any conditions', () => {
    const gated = (when: FormulaDefinition['gates'][number]['when']): FormulaDefinition => ({
      ...formula,
      gates: [{ reason: 'NO_SNOW', when }],
    });
    const a0 = { feature: 'a', is: 'eq', value: 0 } as const;
    const b0 = { feature: 'b', is: 'eq', value: 0 } as const;

    expect(scoreDay(gated({ all: [a0, b0] }), day({ tMax: 5, a: 0, b: 1 })).kind).toBe('scored');
    expect(scoreDay(gated({ all: [a0, b0] }), day({ tMax: 5, a: 0, b: 0 })).kind).toBe('unscored');
    expect(scoreDay(gated({ any: [a0, b0] }), day({ tMax: 5, a: 1, b: 0 })).kind).toBe('unscored');
    expect(scoreDay(gated({ any: [a0, b0] }), day({ tMax: 5, a: 1, b: 1 })).kind).toBe('scored');
  });

  it('fails when a formula reads a feature that no gate requires', () => {
    const careless: FormulaDefinition = { ...formula, gates: [] };

    expect(() => scoreDay(careless, day({ rain: 0 }))).toThrow('tMax');
  });
});

describe('scoreDay formula', () => {
  it('applies multipliers to the combined score', () => {
    const withMultiplier: FormulaDefinition = {
      ...formula,
      multipliers: [
        {
          feature: 'rain',
          curve: {
            kind: 'piecewise',
            anchors: [
              [0, 1],
              [4, 0],
            ],
          },
        },
      ],
    };

    expect(scoreDay(withMultiplier, day({ tMax: 10, rain: 1 }))).toEqual({ kind: 'scored', score: 0.75 });
  });

  it('applies a cap only when its condition holds and never raises a score', () => {
    const capped: FormulaDefinition = {
      ...formula,
      caps: [{ when: { feature: 'rain', is: 'gte', value: 6 }, max: 0.3 }],
    };

    expect(scoreDay(capped, day({ tMax: 10, rain: 5.99 }))).toEqual({ kind: 'scored', score: 1 });
    expect(scoreDay(capped, day({ tMax: 10, rain: 6 }))).toEqual({ kind: 'scored', score: 0.3 });
    expect(scoreDay(capped, day({ tMax: 2, rain: 6 }))).toEqual({ kind: 'scored', score: 0.2 });
  });

  it('reads derived features as if they were raw', () => {
    const derived: FormulaDefinition = {
      ...formula,
      derived: { halfT: { kind: 'divide', inputs: ['tMax'], by: 2 } },
      factors: [{ feature: 'halfT', curve: warmth, weight: 1 }],
    };

    expect(scoreDay(derived, day({ tMax: 10, rain: 0 }))).toEqual({ kind: 'scored', score: 0.5 });
  });

  it('exposes marine features and the sea flag', () => {
    const marine: FormulaDefinition = {
      ...formula,
      gates: [{ reason: 'NO_DATA', when: { missing: ['waveHeight'] } }],
      factors: [{ feature: 'waveHeight', curve: warmth, weight: 1 }],
    };

    expect(
      scoreDay(marine, {
        weather: null,
        marine: { hasSea: true, features: { waveHeight: 5, wavePeriod: 9 } },
      }),
    ).toEqual({ kind: 'scored', score: 0.5 });
  });
});

describe('scoreDay inverted definitions', () => {
  const inverted: ActivityDefinition = {
    name: 'INDOOR_SIGHTSEEING',
    basedOn: formula,
    base: 0.5,
    share: 0.5,
  };

  it('scores base + share * (1 - based-on score)', () => {
    expect(scoreDay(inverted, day({ tMax: 10, rain: 0 }))).toEqual({ kind: 'scored', score: 0.5 });
    expect(scoreDay(inverted, day({ tMax: 0, rain: 0 }))).toEqual({ kind: 'scored', score: 1 });
  });

  it('passes the unscored reason of the based-on definition through', () => {
    expect(scoreDay(inverted, day({ tMax: null, rain: 0 }))).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });
});
