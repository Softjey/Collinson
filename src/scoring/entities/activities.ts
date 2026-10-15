import { FormulaScorer, OppositeScorer } from './activity-scorers.js';
import { Curve } from './curves.js';
import { Combiner, Condition, DerivedFeature } from './formula-parts.js';

const THERMAL_COMFORT_RATING = Curve.stepTable({
  valueBelowFirstStep: 1,
  steps: [
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
  ],
});

const CLOUD_COVER_RATING = Curve.stepTable({
  valueBelowFirstStep: 8,
  steps: [
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
  ],
});

const PRECIPITATION_RATING = Curve.stepTable({
  valueBelowFirstStep: 10,
  steps: [
    [0.02, 9],
    [3, 8],
    [6, 5],
    [9, 2],
    [12, 0],
    [25, -1],
  ],
});

const WIND_RATING = Curve.stepTable({
  valueBelowFirstStep: 8,
  steps: [
    [0.02, 10],
    [10, 9],
    [20, 8],
    [30, 6],
    [40, 3],
    [50, 0],
    [70, -10],
  ],
});

export const OUTDOOR_SIGHTSEEING = new FormulaScorer({
  activity: 'OUTDOOR_SIGHTSEEING',
  requiredSources: ['WEATHER'],
  derivedFeatures: {
    humidex: DerivedFeature.humidex({
      temperature: 'maxTemperatureC',
      relativeHumidity: 'meanRelativeHumidityPercent',
    }),
  },
  unscoredWhen: [
    {
      reason: 'NO_DATA',
      when: Condition.anyMissing(
        'maxTemperatureC',
        'meanRelativeHumidityPercent',
        'meanCloudCoverPercent',
        'totalPrecipitationMm',
        'meanWindSpeedKmh',
        'maxWindSpeedKmh',
      ),
    },
  ],
  factors: [
    { feature: 'humidex', weight: 4, utility: THERMAL_COMFORT_RATING },
    { feature: 'meanCloudCoverPercent', weight: 2, utility: CLOUD_COVER_RATING },
    { feature: 'totalPrecipitationMm', weight: 3, utility: PRECIPITATION_RATING },
    { feature: 'meanWindSpeedKmh', weight: 1, utility: WIND_RATING },
  ],
  combiner: Combiner.weightedSum({ divisor: 100 }),
  caps: [
    { when: Condition.atLeast('totalPrecipitationMm', 6), max: 0.5 },
    {
      when: Condition.anyOf(
        Condition.atLeast('maxWindSpeedKmh', 60),
        Condition.atLeast('totalPrecipitationMm', 25),
      ),
      max: 0.2,
    },
  ],
});

export const INDOOR_SIGHTSEEING = new OppositeScorer('INDOOR_SIGHTSEEING', OUTDOOR_SIGHTSEEING, {
  floor: 0.5,
  spread: 0.5,
});

export const SKIING = new FormulaScorer({
  activity: 'SKIING',
  requiredSources: ['WEATHER'],
  derivedFeatures: {
    meanWindSpeedMs: DerivedFeature.quotient({ of: 'meanWindSpeedKmh', dividedBy: 3.6 }),
  },
  unscoredWhen: [
    {
      reason: 'NO_DATA',
      when: Condition.anyMissing(
        'maxTemperatureC',
        'meanCloudCoverPercent',
        'meanWindSpeedKmh',
        'totalRainMm',
        'totalSnowfallCm',
        'maxSnowDepthM',
        'snowfallHours',
      ),
    },
    {
      reason: 'NO_SNOW',
      when: Condition.allOf(Condition.equals('maxSnowDepthM', 0), Condition.equals('totalSnowfallCm', 0)),
    },
  ],
  factors: [
    {
      feature: 'snowfallHours',
      weight: 0.303,
      utility: Curve.piecewiseLinear(
        [0, 0.98],
        [1, 0.96],
        [2, 0.81],
        [3, 0.58],
        [4, 0.31],
        [5, 0.06],
        [6, 0],
      ),
    },
    {
      feature: 'meanWindSpeedMs',
      weight: 0.279,
      utility: Curve.piecewiseLinear([0, 1], [5, 0.64], [10, 0.26], [14, 0]),
    },
    {
      feature: 'maxTemperatureC',
      weight: 0.222,
      utility: Curve.piecewiseLinear(
        [-12, 0],
        [-8, 0.06],
        [-5, 0.23],
        [-2, 0.56],
        [0, 0.8],
        [1.5, 0.94],
        [3, 1],
        [5, 0.94],
        [7, 0.74],
        [10, 0.35],
        [13, 0.06],
        [15, 0],
      ),
    },
    {
      feature: 'meanCloudCoverPercent',
      weight: 0.194,
      utility: Curve.piecewiseLinear([25, 1], [100, 0]),
    },
  ],
  combiner: Combiner.weightedSum(),
  multipliers: [
    { feature: 'totalRainMm', utility: Curve.piecewiseLinear([0, 1], [3, 0]) },
    { feature: 'maxSnowDepthM', utility: Curve.piecewiseLinear([0, 0], [0.3, 1]) },
  ],
});

export const SURFING = new FormulaScorer({
  activity: 'SURFING',
  requiredSources: ['WEATHER', 'WAVES'],
  unscoredWhen: [
    { reason: 'NO_SEA', when: Condition.equals('hasSea', 0) },
    { reason: 'NO_DATA', when: Condition.anyMissing('maxWindSpeedKmh', 'maxWaveHeightM', 'maxWavePeriodS') },
  ],
  factors: [
    {
      feature: 'maxWaveHeightM',
      weight: 0.35,
      utility: Curve.piecewiseLinear([0.3, 0], [0.8, 0.6], [1, 1], [2, 1], [3, 0.5], [4, 0]),
    },
    {
      feature: 'maxWavePeriodS',
      weight: 0.35,
      utility: Curve.piecewiseLinear([5, 0], [8, 0.4], [10, 0.7], [13, 1]),
    },
    {
      feature: 'maxWindSpeedKmh',
      weight: 0.3,
      utility: Curve.piecewiseLinear([15, 1], [25, 0.7], [40, 0.3], [55, 0]),
    },
  ],
  combiner: Combiner.weightedProduct(),
});

export const ALL_ACTIVITY_SCORERS = [SKIING, SURFING, OUTDOOR_SIGHTSEEING, INDOOR_SIGHTSEEING] as const;
