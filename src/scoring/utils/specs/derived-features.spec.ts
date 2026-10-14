import { computeDerived, humidex } from '../derived-features.js';

describe('humidex', () => {
  it('equals the temperature when the vapour term is zero', () => {
    expect(humidex(0, 0)).toBeCloseTo(-5.56, 1);
  });

  it('is computed from temperature and relative humidity', () => {
    expect(humidex(20, 50)).toBeCloseTo(20.93, 1);
    expect(humidex(30, 70)).toBeCloseTo(40.9, 1);
  });

  it('gives a dry heat value of 47.8 at 42 C and 25%', () => {
    expect(humidex(42, 25)).toBeCloseTo(47.8, 1);
  });

  it('gives 50.9 for the humid tropics at 32.8 C and 86%', () => {
    expect(humidex(32.8, 86)).toBeCloseTo(50.9, 0);
  });
});

describe('computeDerived', () => {
  it('computes a humidex feature from its inputs', () => {
    const spec = { kind: 'humidex', inputs: ['t', 'rh'] } as const;

    expect(computeDerived(spec, { t: 20, rh: 50 })).toBeCloseTo(20.93, 1);
  });

  it('divides a feature by a constant', () => {
    const spec = { kind: 'divide', inputs: ['wind'], by: 3.6 } as const;

    expect(computeDerived(spec, { wind: 36 })).toBe(10);
  });

  it('is null when an input is missing', () => {
    const spec = { kind: 'humidex', inputs: ['t', 'rh'] } as const;

    expect(computeDerived(spec, { t: 20, rh: null })).toBeNull();
    expect(computeDerived(spec, { t: 20 })).toBeNull();
  });

  it('rejects an unknown kind', () => {
    expect(() => computeDerived({ kind: 'dewpoint', inputs: [] } as never, {})).toThrow('dewpoint');
  });
});
