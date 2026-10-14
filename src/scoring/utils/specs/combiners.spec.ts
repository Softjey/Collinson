import { combine } from '../combiners.js';

describe('combine', () => {
  const terms = [
    { value: 0.5, weight: 2 },
    { value: 1, weight: 1 },
  ];

  it('weightedSum adds weight * value and divides', () => {
    expect(combine({ kind: 'weightedSum' }, terms)).toBe(1);
    expect(combine({ kind: 'weightedSum', divisor: 4 }, terms)).toBeCloseTo(0.5);
  });

  it('weightedSum clamps to 0..1', () => {
    expect(combine({ kind: 'weightedSum' }, [{ value: 1, weight: 5 }])).toBe(1);
    expect(combine({ kind: 'weightedSum', divisor: 10 }, [{ value: -3, weight: 4 }])).toBe(0);
  });

  it('geometric multiplies value ** weight', () => {
    expect(
      combine({ kind: 'geometric' }, [
        { value: 0.25, weight: 0.5 },
        { value: 0.5, weight: 1 },
      ]),
    ).toBeCloseTo(0.25);
  });

  it('geometric is 0 when any term is 0', () => {
    expect(
      combine({ kind: 'geometric' }, [
        { value: 0, weight: 0.35 },
        { value: 1, weight: 0.35 },
      ]),
    ).toBe(0);
  });

  it('rejects an unknown combiner kind', () => {
    expect(() => combine({ kind: 'median' } as never, terms)).toThrow('median');
  });
});
