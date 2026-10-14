import type { ActivityDefinition, FormulaDefinition, InvertedDefinition } from './definition.types.js';
import type { Step } from './math.js';

const steps = (...pairs: [from: number, value: number][]): { kind: 'steps'; steps: Step<number>[] } => ({
  kind: 'steps',
  steps: pairs.map(([from, value]) => ({ from, value })),
});

export const OUTDOOR_SIGHTSEEING: FormulaDefinition = {
  name: 'OUTDOOR_SIGHTSEEING',
  sources: ['WEATHER'],
  derived: { humidex: { kind: 'humidex', inputs: ['tMax', 'rhMean'] } },
  gates: [
    { reason: 'NO_DATA', when: { missing: ['tMax', 'rhMean', 'cloud', 'precip', 'windMean', 'windMax'] } },
  ],
  factors: [
    {
      feature: 'humidex',
      weight: 4,
      curve: steps(
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
    },
    {
      feature: 'cloud',
      weight: 2,
      curve: steps(
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
    },
    {
      feature: 'precip',
      weight: 3,
      curve: steps([-Infinity, 10], [0.02, 9], [3, 8], [6, 5], [9, 2], [12, 0], [25, -1]),
    },
    {
      feature: 'windMean',
      weight: 1,
      curve: steps([-Infinity, 8], [0.02, 10], [10, 9], [20, 8], [30, 6], [40, 3], [50, 0], [70, -10]),
    },
  ],
  combiner: { kind: 'weightedSum', divisor: 100 },
  caps: [
    { when: { feature: 'precip', is: 'gte', value: 6 }, max: 0.5 },
    {
      when: {
        any: [
          { feature: 'windMax', is: 'gte', value: 60 },
          { feature: 'precip', is: 'gte', value: 25 },
        ],
      },
      max: 0.2,
    },
  ],
};

export const INDOOR_SIGHTSEEING: InvertedDefinition = {
  name: 'INDOOR_SIGHTSEEING',
  basedOn: OUTDOOR_SIGHTSEEING,
  base: 0.5,
  share: 0.5,
};

export const SKIING: FormulaDefinition = {
  name: 'SKIING',
  sources: ['WEATHER'],
  derived: { windMeanMs: { kind: 'divide', inputs: ['windMean'], by: 3.6 } },
  gates: [
    {
      reason: 'NO_DATA',
      when: {
        missing: ['tMax', 'cloud', 'windMean', 'rain', 'snowfallSum', 'snowDepthMax', 'snowHours'],
      },
    },
    {
      reason: 'NO_SNOW',
      when: {
        all: [
          { feature: 'snowDepthMax', is: 'eq', value: 0 },
          { feature: 'snowfallSum', is: 'eq', value: 0 },
        ],
      },
    },
  ],
  factors: [
    {
      feature: 'snowHours',
      weight: 0.303,
      curve: { kind: 'polynomial', coefficients: [98.05, 6.39, -9.03, 0.81], divisor: 100, zeroAbove: 5 },
    },
    {
      feature: 'windMeanMs',
      weight: 0.279,
      curve: { kind: 'polynomial', coefficients: [104.37, -6.78, -0.19, 0.01], divisor: 104.37 },
    },
    {
      feature: 'tMax',
      weight: 0.222,
      curve: { kind: 'peakNormalizedGev', shape: 0.34, location: 1.45, scale: 4.6 },
    },
    {
      feature: 'cloud',
      weight: 0.194,
      curve: {
        kind: 'piecewise',
        anchors: [
          [25, 1],
          [100, 0],
        ],
      },
    },
  ],
  combiner: { kind: 'weightedSum' },
  multipliers: [
    {
      feature: 'rain',
      curve: {
        kind: 'piecewise',
        anchors: [
          [0, 1],
          [3, 0],
        ],
      },
    },
    {
      feature: 'snowDepthMax',
      curve: {
        kind: 'piecewise',
        anchors: [
          [0, 0],
          [0.3, 1],
        ],
      },
    },
  ],
};

export const SURFING: FormulaDefinition = {
  name: 'SURFING',
  sources: ['WEATHER', 'WAVES'],
  gates: [
    { reason: 'NO_SEA', when: { feature: 'hasSea', is: 'eq', value: 0 } },
    { reason: 'NO_DATA', when: { missing: ['windMax', 'waveHeight', 'wavePeriod'] } },
  ],
  factors: [
    {
      feature: 'waveHeight',
      weight: 0.35,
      curve: {
        kind: 'piecewise',
        anchors: [
          [0.3, 0],
          [0.8, 0.6],
          [1, 1],
          [2, 1],
          [3, 0.5],
          [4, 0],
        ],
      },
    },
    {
      feature: 'wavePeriod',
      weight: 0.35,
      curve: {
        kind: 'piecewise',
        anchors: [
          [5, 0],
          [8, 0.4],
          [10, 0.7],
          [13, 1],
        ],
      },
    },
    {
      feature: 'windMax',
      weight: 0.3,
      curve: {
        kind: 'piecewise',
        anchors: [
          [15, 1],
          [25, 0.7],
          [40, 0.3],
          [55, 0],
        ],
      },
    },
  ],
  combiner: { kind: 'geometric' },
};

export const ACTIVITY_DEFINITIONS: readonly ActivityDefinition[] = [
  SKIING,
  SURFING,
  OUTDOOR_SIGHTSEEING,
  INDOOR_SIGHTSEEING,
];
