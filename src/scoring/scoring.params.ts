import type { Anchor, Step } from './math.js';

export const CATEGORY_BANDS = [
  { from: 0, index: 1, category: 'UNSUITABLE' },
  { from: 0.1, index: 2, category: 'POOR' },
  { from: 0.4, index: 3, category: 'MARGINAL' },
  { from: 0.5, index: 4, category: 'ACCEPTABLE' },
  { from: 0.6, index: 5, category: 'GOOD' },
  { from: 0.7, index: 6, category: 'VERY_GOOD' },
  { from: 0.8, index: 7, category: 'EXCELLENT' },
  { from: 0.9, index: 8, category: 'IDEAL' },
] as const;

const steps = (...pairs: [from: number, value: number][]): Step<number>[] =>
  pairs.map(([from, value]) => ({ from, value }));

export const OUTDOOR_PARAMS = {
  weights: { thermalComfort: 4, cloud: 2, precipitation: 3, wind: 1 },
  hciMax: 100,
  humidexRating: steps(
    [-Infinity, 1],
    [-6, 2],
    [0, 3],
    [7, 4],
    [11, 5],
    [15, 6],
    [18, 7],
    [20, 9],
    [23, 10],
    [26, 9],
    [27, 8],
    [29, 7],
    [31, 6],
    [33, 5],
    [35, 4],
    [37, 2],
    [39, 0],
  ),
  cloudRating: steps(
    [-Infinity, 8],
    [1, 9],
    [11, 10],
    [21, 9],
    [31, 8],
    [41, 7],
    [51, 6],
    [61, 5],
    [71, 4],
    [81, 3],
    [91, 2],
    [100, 1],
  ),
  precipitationRating: steps([-Infinity, 10], [0.02, 9], [3, 8], [6, 5], [9, 2], [12, 0], [25, -1]),
  windRating: steps([-Infinity, 8], [0.02, 10], [10, 9], [20, 8], [30, 6], [40, 3], [50, 0], [70, -10]),
  caps: {
    wet: { precipitationFrom: 6, maxScore: 0.5 },
    storm: { windMaxFrom: 60, precipitationFrom: 25, maxScore: 0.2 },
  },
};

export const INDOOR_PARAMS = {
  base: 0.5,
  outdoorShare: 0.5,
};

export const SKIING_PARAMS = {
  weights: { snow: 0.303, wind: 0.279, temperature: 0.222, cloud: 0.194 },
  maxSnowHours: 5,
  snowPolynomial: { c0: 98.05, c1: 6.39, c2: -9.03, c3: 0.81, divisor: 100 },
  windPolynomial: { c0: 104.37, c1: -6.78, c2: -0.19, c3: 0.01, divisor: 104.37 },
  kmhPerMs: 3.6,
  temperature: { c: 0.34, loc: 1.45, s: 4.6 },
  cloudRange: 75,
  rainZeroAt: 3,
  fullDepthAt: 0.3,
};

export const SURFING_PARAMS = {
  waveHeight: [
    [0.3, 0],
    [0.8, 0.6],
    [1.0, 1],
    [2.0, 1],
    [3.0, 0.5],
    [4.0, 0],
  ] as readonly Anchor[],
  wavePeriod: [
    [5, 0],
    [8, 0.4],
    [10, 0.7],
    [13, 1],
  ] as readonly Anchor[],
  wind: [
    [15, 1],
    [25, 0.7],
    [40, 0.3],
    [55, 0],
  ] as readonly Anchor[],
  exponents: { waveHeight: 0.35, wavePeriod: 0.35, wind: 0.3 },
};
