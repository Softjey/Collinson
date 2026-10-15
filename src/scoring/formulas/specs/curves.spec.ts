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
