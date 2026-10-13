import { loadEventFeatures } from '../../../../test/fixtures/scoring/load.js';
import { categorize } from '../../category.js';
import type { WeatherDayFeatures } from '../../daily-features.js';
import {
  OutdoorSightseeingScorer,
  cloudRating,
  holidayClimateIndex,
  humidex,
  outdoorScore,
  precipitationRating,
  thermalComfortRating,
  windRating,
} from '.././outdoor.scorer.js';

const pleasantDay: WeatherDayFeatures = {
  tMax: 22,
  rhMean: 50,
  precip: 0,
  rain: 0,
  snowfallSum: 0,
  snowDepthMax: 0,
  snowHours: 0,
  cloud: 20,
  windMean: 15,
  windMax: 20,
};

const day = (overrides: Partial<WeatherDayFeatures>): WeatherDayFeatures => ({
  ...pleasantDay,
  ...overrides,
});

describe('humidex', () => {
  it('equals the temperature when the vapour term is zero', () => {
    expect(humidex(0, 0)).toBeCloseTo(-5.56, 1);
  });

  it('is computed from temperature and relative humidity', () => {
    expect(humidex(20, 50)).toBeCloseTo(20.93, 1);
    expect(humidex(30, 70)).toBeCloseTo(40.9, 1);
  });

  it('gives a dry heat value of 47.8 at 42 C and 25%', () => {
    expect(humidex(42, 25)).toBeCloseTo(47.8, 1);
  });

  it('gives 50.9 for the humid tropics at 32.8 C and 86%', () => {
    expect(humidex(32.8, 86)).toBeCloseTo(50.9, 0);
  });
});

describe('rating tables', () => {
  it.each([
    [-30, 1],
    [-6.01, 1],
    [-6, 2],
    [-0.01, 2],
    [0, 3],
    [6.99, 3],
    [7, 4],
    [10.99, 4],
    [11, 5],
    [14.99, 5],
    [15, 6],
    [17.99, 6],
    [18, 7],
    [19.99, 7],
    [20, 9],
    [22.99, 9],
    [23, 10],
    [25.99, 10],
    [26, 9],
    [26.99, 9],
    [27, 8],
    [28.99, 8],
    [29, 7],
    [30.99, 7],
    [31, 6],
    [32.99, 6],
    [33, 5],
    [34.99, 5],
    [35, 4],
    [36.99, 4],
    [37, 2],
    [38.99, 2],
    [39, 0],
    [60, 0],
  ])('rates humidex %s as %s', (value, rating) => {
    expect(thermalComfortRating(value)).toBe(rating);
  });

  it.each([
    [0, 8],
    [0.99, 8],
    [1, 9],
    [10.99, 9],
    [11, 10],
    [20.99, 10],
    [21, 9],
    [30.99, 9],
    [31, 8],
    [40.99, 8],
    [41, 7],
    [50.99, 7],
    [51, 6],
    [60.99, 6],
    [61, 5],
    [70.99, 5],
    [71, 4],
    [80.99, 4],
    [81, 3],
    [90.99, 3],
    [91, 2],
    [99.99, 2],
    [100, 1],
  ])('rates cloud cover %s as %s', (value, rating) => {
    expect(cloudRating(value)).toBe(rating);
  });

  it.each([
    [0, 10],
    [0.01, 10],
    [0.02, 9],
    [2.99, 9],
    [3, 8],
    [5.99, 8],
    [6, 5],
    [8.99, 5],
    [9, 2],
    [11.99, 2],
    [12, 0],
    [24.99, 0],
    [25, -1],
    [100, -1],
  ])('rates precipitation %s mm as %s', (value, rating) => {
    expect(precipitationRating(value)).toBe(rating);
  });

  it.each([
    [0, 8],
    [0.01, 8],
    [0.02, 10],
    [9.99, 10],
    [10, 9],
    [19.99, 9],
    [20, 8],
    [29.99, 8],
    [30, 6],
    [39.99, 6],
    [40, 3],
    [49.99, 3],
    [50, 0],
    [69.99, 0],
    [70, -10],
    [120, -10],
  ])('rates mean wind %s km/h as %s', (value, rating) => {
    expect(windRating(value)).toBe(rating);
  });
});

describe('holidayClimateIndex', () => {
  it('weights the ratings 4, 2, 3 and 1', () => {
    expect(holidayClimateIndex(day({}))).toBeCloseTo(0.99);
  });

  it('never goes below 0 when ratings are negative', () => {
    const storm = day({ tMax: 50, rhMean: 100, cloud: 100, precip: 30, windMean: 80, windMax: 100 });

    expect(holidayClimateIndex(storm)).toBe(0);
  });

  it('never goes above 1', () => {
    expect(holidayClimateIndex(day({ tMax: 24, rhMean: 40, cloud: 15, windMean: 5 }))).toBeLessThanOrEqual(1);
  });
});

describe('outdoorScore caps', () => {
  it('does not cap 5.99 mm of precipitation', () => {
    expect(outdoorScore(day({ precip: 5.99 }))).toBeCloseTo(0.93);
  });

  it('caps 6 mm of precipitation at 0.5', () => {
    expect(outdoorScore(day({ precip: 6 }))).toBe(0.5);
  });

  it('does not cap a maximum wind of 59.9 km/h', () => {
    expect(outdoorScore(day({ windMax: 59.9 }))).toBeCloseTo(0.99);
  });

  it('caps a maximum wind of 60 km/h at 0.2', () => {
    expect(outdoorScore(day({ windMax: 60 }))).toBe(0.2);
  });

  it('caps 25 mm of precipitation at 0.2', () => {
    expect(outdoorScore(day({ precip: 25 }))).toBe(0.2);
  });

  it('leaves a score that is already below the cap unchanged', () => {
    const gloomy = day({ tMax: 5, cloud: 100, precip: 6 });

    expect(holidayClimateIndex(gloomy)).toBeCloseTo(0.38);
    expect(outdoorScore(gloomy)).toBeCloseTo(0.38);
  });
});

describe('outdoorScore data', () => {
  it.each(['tMax', 'rhMean', 'precip', 'cloud', 'windMean', 'windMax'] as const)(
    'is null when %s is missing',
    (feature) => {
      expect(outdoorScore(day({ [feature]: null }))).toBeNull();
    },
  );

  it('does not need snow features', () => {
    expect(outdoorScore(day({ snowDepthMax: null, snowHours: null, rain: null }))).not.toBeNull();
  });
});

describe('outdoor scoring of the dated events', () => {
  it('scores London on 2022-02-18 0.63 before the caps and 0.20 after', () => {
    const london = loadEventFeatures('london', '2022-02-18');

    expect(categorize(holidayClimateIndex(london) ?? NaN).score).toBe(0.63);
    expect(categorize(outdoorScore(london) ?? NaN).score).toBe(0.2);
  });

  it('scores Hong Kong on 2023-09-01 0.23 before the caps and 0.20 after', () => {
    const hongKong = loadEventFeatures('hong-kong', '2023-09-01');

    expect(categorize(holidayClimateIndex(hongKong) ?? NaN).score).toBe(0.23);
    expect(categorize(outdoorScore(hongKong) ?? NaN).score).toBe(0.2);
  });

  it('scores Hong Kong on 2023-09-02 below 0.10', () => {
    const hongKong = loadEventFeatures('hong-kong', '2023-09-02');

    expect(outdoorScore(hongKong)).toBeLessThan(0.1);
  });
});

describe('OutdoorSightseeingScorer', () => {
  const scorer = new OutdoorSightseeingScorer();

  it('declares the outdoor activity and the weather source', () => {
    expect(scorer.activity).toBe('OUTDOOR_SIGHTSEEING');
    expect(scorer.requiredSources).toEqual(['WEATHER']);
  });

  it('scores a day with weather features', () => {
    const outcome = scorer.evaluate({ weather: day({}), marine: null });

    expect(outcome.kind).toBe('scored');
  });

  it('is NO_DATA without weather', () => {
    expect(scorer.evaluate({ weather: null, marine: null })).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('is NO_DATA when a needed feature is missing', () => {
    expect(scorer.evaluate({ weather: day({ windMax: null }), marine: null })).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });
});
