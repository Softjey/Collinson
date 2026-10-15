import { fromE2, roundCoordinate, toE2 } from '../coordinates.js';

describe('coordinates', () => {
  it('rounds degrees to hundredths', () => {
    expect(toE2(41.404)).toBe(4140);
    expect(toE2(-2.178)).toBe(-218);
  });

  it('turns hundredths back into degrees', () => {
    expect(fromE2(4140)).toBe(41.4);
    expect(fromE2(-218)).toBe(-2.18);
  });

  it('round-trips a value that is already rounded', () => {
    expect(toE2(fromE2(4138))).toBe(4138);
  });

  describe('roundCoordinate', () => {
    it.each([
      [41.3851, 41.39],
      [-0.1278, -0.13],
      [89.999, 90],
      [-179.996, -180],
      [12, 12],
    ])('rounds %s to %s', (degrees, expected) => {
      expect(roundCoordinate(degrees)).toBe(expected);
    });

    it('never returns negative zero', () => {
      expect(Object.is(roundCoordinate(-0.001), 0)).toBe(true);
      expect(Object.is(toE2(-0.001), 0)).toBe(true);
    });
  });
});
