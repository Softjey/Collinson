import { clamp, interpolate, stepLookup } from '../math.js';

describe('clamp', () => {
  it('returns the value inside the range', () => {
    expect(clamp(0.4)).toBe(0.4);
  });

  it('limits values below the range to the lower bound', () => {
    expect(clamp(-0.2)).toBe(0);
  });

  it('limits values above the range to the upper bound', () => {
    expect(clamp(1.7)).toBe(1);
  });

  it('accepts custom bounds', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('interpolate', () => {
  const anchors = [
    [5, 0],
    [8, 0.4],
    [10, 0.7],
    [13, 1],
  ] as const;

  it('returns the anchor value on an anchor', () => {
    expect(interpolate(anchors, 8)).toBe(0.4);
  });

  it('interpolates linearly between anchors', () => {
    expect(interpolate(anchors, 9)).toBeCloseTo(0.55);
  });

  it('is flat below the first anchor', () => {
    expect(interpolate(anchors, 1)).toBe(0);
  });

  it('is flat above the last anchor', () => {
    expect(interpolate(anchors, 20)).toBe(1);
  });

  it('supports decreasing anchors', () => {
    expect(
      interpolate(
        [
          [15, 1],
          [25, 0.7],
        ],
        20,
      ),
    ).toBeCloseTo(0.85);
  });
});

describe('stepLookup', () => {
  const table = [
    { from: -Infinity, value: 'low' },
    { from: 0, value: 'mid' },
    { from: 7, value: 'high' },
  ];

  it('uses the lower bound inclusively', () => {
    expect(stepLookup(table, 7)).toBe('high');
    expect(stepLookup(table, 0)).toBe('mid');
  });

  it('keeps values just below a bound in the previous step', () => {
    expect(stepLookup(table, 6.99)).toBe('mid');
    expect(stepLookup(table, 6.999999)).toBe('mid');
    expect(stepLookup(table, -0.01)).toBe('low');
  });

  it('handles values far above the last bound', () => {
    expect(stepLookup(table, 1000)).toBe('high');
  });

  it('throws when the value is below the first bound', () => {
    expect(() => stepLookup([{ from: 0, value: 'a' }], -1)).toThrow(RangeError);
  });
});
