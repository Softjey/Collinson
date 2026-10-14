export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export type Anchor = readonly [x: number, y: number];

export function interpolate(anchors: readonly Anchor[], x: number): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];

  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i];
    if (x === x1) return y1;
    if (x < x1) {
      const [x0, y0] = anchors[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

export interface Step<T> {
  from: number;
  value: T;
}

export function stepLookup<T>(table: readonly Step<T>[], x: number): T {
  for (let i = table.length - 1; i >= 0; i--) {
    if (x >= table[i].from) return table[i].value;
  }
  throw new RangeError(`No step covers ${x}`);
}
