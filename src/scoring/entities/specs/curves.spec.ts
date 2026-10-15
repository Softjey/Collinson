import { Curve } from '../curves.js';

describe('Curve.piecewiseLinear', () => {
  const curve = Curve.piecewiseLinear([1, 0], [3, 1]);

  it('is flat outside the points', () => {
    expect(curve.valueAt(0)).toBe(0);
    expect(curve.valueAt(5)).toBe(1);
  });

  it('is exact on the points and linear between them', () => {
    expect(curve.valueAt(1)).toBe(0);
    expect(curve.valueAt(3)).toBe(1);
    expect(curve.valueAt(2)).toBeCloseTo(0.5);
  });
});

describe('Curve.stepTable', () => {
  const curve = Curve.stepTable({ valueBelowFirstStep: 1, steps: [[7, 4]] });

  it('uses the lower bound of each row', () => {
    expect(curve.valueAt(6.99)).toBe(1);
    expect(curve.valueAt(7)).toBe(4);
    expect(curve.valueAt(100)).toBe(4);
  });

  it('applies the first value to everything below the first bound', () => {
    expect(curve.valueAt(-1000)).toBe(1);
  });
});

describe('Curve.polynomial', () => {
  const options = { coefficients: [2, 1, 0, 0.5], divisor: 10 };

  it('adds the coefficients by ascending power and divides', () => {
    expect(Curve.polynomial(options).valueAt(2)).toBeCloseTo((2 + 2 + 0.5 * 8) / 10);
  });

  it('clamps to 0..1', () => {
    expect(Curve.polynomial(options).valueAt(100)).toBe(1);
    expect(Curve.polynomial({ coefficients: [-1], divisor: 1 }).valueAt(0)).toBe(0);
  });

  it('is 0 above the zeroAbove limit and evaluated up to it', () => {
    const limited = Curve.polynomial({ ...options, zeroAbove: 2 });

    expect(limited.valueAt(2)).toBeGreaterThan(0);
    expect(limited.valueAt(2.01)).toBe(0);
  });
});

describe('Curve.peakNormalizedExtremeValue', () => {
  const curve = Curve.peakNormalizedExtremeValue({ shape: 0.34, location: 1.45, scale: 4.6 });

  it('peaks at 1 near the mode and is never above 1', () => {
    expect(curve.valueAt(3)).toBeGreaterThan(0.99);
    for (let x = -20; x <= 20; x += 0.5) expect(curve.valueAt(x)).toBeLessThanOrEqual(1);
  });

  it('is 0 beyond the upper support limit', () => {
    expect(curve.valueAt(15)).toBe(0);
    expect(curve.valueAt(30)).toBe(0);
  });
});
