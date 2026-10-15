import { fromE2, toE2 } from '../coordinates.js';

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
});
