import { compileCurve, type CurveSpec } from '../curves.js';

describe('compileCurve', () => {
  describe('piecewise', () => {
    const curve = compileCurve({
      kind: 'piecewise',
      anchors: [
        [1, 0],
        [3, 1],
      ],
    });

    it('is flat outside the anchors', () => {
      expect(curve(0)).toBe(0);
      expect(curve(5)).toBe(1);
    });

    it('is exact on anchors and linear between them', () => {
      expect(curve(1)).toBe(0);
      expect(curve(3)).toBe(1);
      expect(curve(2)).toBeCloseTo(0.5);
    });
  });

  describe('steps', () => {
    const curve = compileCurve({
      kind: 'steps',
      steps: [
        { from: -Infinity, value: 1 },
        { from: 7, value: 4 },
      ],
    });

    it('uses the lower bound of each band', () => {
      expect(curve(6.99)).toBe(1);
      expect(curve(7)).toBe(4);
      expect(curve(100)).toBe(4);
    });

    it('fails when no band covers the value', () => {
      const uncovered = compileCurve({ kind: 'steps', steps: [{ from: 0, value: 1 }] });

      expect(() => uncovered(-1)).toThrow(RangeError);
    });
  });

  describe('polynomial', () => {
    const spec: CurveSpec = { kind: 'polynomial', coefficients: [2, 1, 0, 0.5], divisor: 10 };

    it('evaluates the coefficients in ascending order and divides', () => {
      expect(compileCurve(spec)(2)).toBeCloseTo((2 + 2 + 0.5 * 8) / 10);
    });

    it('clamps to 0..1', () => {
      expect(compileCurve(spec)(100)).toBe(1);
      expect(compileCurve({ kind: 'polynomial', coefficients: [-1], divisor: 1 })(0)).toBe(0);
    });

    it('is 0 above the zeroAbove limit and evaluated up to it', () => {
      const limited = compileCurve({ ...spec, zeroAbove: 2 });

      expect(limited(2)).toBeGreaterThan(0);
      expect(limited(2.01)).toBe(0);
    });
  });

  describe('peakNormalizedGev', () => {
    const curve = compileCurve({ kind: 'peakNormalizedGev', shape: 0.34, location: 1.45, scale: 4.6 });

    it('peaks at 1 near the mode and is never above 1', () => {
      expect(curve(3)).toBeGreaterThan(0.99);
      for (let x = -20; x <= 20; x += 0.5) expect(curve(x)).toBeLessThanOrEqual(1);
    });

    it('is 0 beyond the upper support limit', () => {
      expect(curve(15)).toBe(0);
      expect(curve(30)).toBe(0);
    });
  });

  it('rejects an unknown curve kind', () => {
    expect(() => compileCurve({ kind: 'spline' } as never)).toThrow('spline');
  });

  it('compiles a spec only once', () => {
    const spec: CurveSpec = { kind: 'piecewise', anchors: [[0, 0]] };

    expect(compileCurve(spec)).toBe(compileCurve(spec));
  });
});
