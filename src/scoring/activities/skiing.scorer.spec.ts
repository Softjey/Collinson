import { loadEventFeatures } from '../../../test/fixtures/scoring/load.js';
import { categorize } from '../category.js';
import type { WeatherDayFeatures } from '../daily-features.js';
import {
  SkiingScorer,
  cloudUtility,
  depthMultiplier,
  rainMultiplier,
  skiingOutcome,
  snowUtility,
  temperatureUtility,
  windUtility,
} from './skiing.scorer.js';

const snowyDay: WeatherDayFeatures = {
  tMax: 3,
  rhMean: 70,
  precip: 0,
  rain: 0,
  snowfallSum: 0,
  snowDepthMax: 0.5,
  snowHours: 0,
  cloud: 25,
  windMean: 0,
  windMax: 5,
};

const day = (overrides: Partial<WeatherDayFeatures>): WeatherDayFeatures => ({ ...snowyDay, ...overrides });

describe('snowUtility', () => {
  it('is 0.9805 without snowing hours', () => {
    expect(snowUtility(0)).toBeCloseTo(0.9805);
  });

  it('is 0.055 at 5 hours', () => {
    expect(snowUtility(5)).toBeCloseTo(0.055);
  });

  it('is 0 above 5 hours', () => {
    expect(snowUtility(6)).toBe(0);
    expect(snowUtility(24)).toBe(0);
  });
});

describe('windUtility', () => {
  it('is 1 in calm air', () => {
    expect(windUtility(0)).toBe(1);
  });

  it('converts km/h to m/s before applying the polynomial', () => {
    expect(windUtility(36)).toBeCloseTo((104.37 - 67.8 - 19 + 10) / 104.37);
  });

  it('is 0 in a gale', () => {
    expect(windUtility(100)).toBe(0);
  });
});

describe('temperatureUtility', () => {
  it('is 1 at the peak near 3 C', () => {
    expect(temperatureUtility(3)).toBeGreaterThan(0.99);
    expect(temperatureUtility(3)).toBeLessThanOrEqual(1);
  });

  it('is never above 1', () => {
    for (let t = -20; t <= 20; t += 0.5) {
      expect(temperatureUtility(t)).toBeLessThanOrEqual(1);
    }
  });

  it('is about 0 below -12 C', () => {
    expect(temperatureUtility(-12)).toBeLessThan(0.01);
    expect(temperatureUtility(-25)).toBeCloseTo(0, 5);
  });

  it('is 0 at and above about 15 C', () => {
    expect(temperatureUtility(15)).toBe(0);
    expect(temperatureUtility(30)).toBe(0);
  });

  it('is between 0 and 1 in the usable range', () => {
    expect(temperatureUtility(-5)).toBeGreaterThan(0);
    expect(temperatureUtility(10)).toBeGreaterThan(0);
  });
});

describe('cloudUtility', () => {
  it('is 1 at 25% or less', () => {
    expect(cloudUtility(25)).toBe(1);
    expect(cloudUtility(0)).toBe(1);
  });

  it('is 0 at 100%', () => {
    expect(cloudUtility(100)).toBe(0);
  });

  it('is linear in between', () => {
    expect(cloudUtility(62.5)).toBeCloseTo(0.5);
  });
});

describe('multipliers', () => {
  it('rain is 1 at 0 mm and 0 at 3 mm and above', () => {
    expect(rainMultiplier(0)).toBe(1);
    expect(rainMultiplier(1.5)).toBeCloseTo(0.5);
    expect(rainMultiplier(3)).toBe(0);
    expect(rainMultiplier(10)).toBe(0);
  });

  it('depth is linear to 0.3 m and 1 above', () => {
    expect(depthMultiplier(0)).toBe(0);
    expect(depthMultiplier(0.15)).toBeCloseTo(0.5);
    expect(depthMultiplier(0.3)).toBe(1);
    expect(depthMultiplier(2)).toBe(1);
  });
});

describe('skiingOutcome', () => {
  it('is NO_SNOW when depth and snowfall are both 0', () => {
    expect(skiingOutcome(day({ snowDepthMax: 0, snowfallSum: 0 }))).toEqual({
      kind: 'unscored',
      reason: 'NO_SNOW',
    });
  });

  it('is scored when only the snow depth is positive', () => {
    expect(skiingOutcome(day({ snowDepthMax: 0.4, snowfallSum: 0 })).kind).toBe('scored');
  });

  it('is scored when only the snowfall is positive', () => {
    expect(skiingOutcome(day({ snowDepthMax: 0, snowfallSum: 1, snowHours: 2 }))).toEqual({
      kind: 'scored',
      score: 0,
    });
  });

  it('combines the weighted utilities with the multipliers', () => {
    const outcome = skiingOutcome(day({ rain: 1.5, snowDepthMax: 0.15, snowHours: 1 }));
    const sui =
      0.303 * snowUtility(1) +
      0.279 * windUtility(0) +
      0.222 * temperatureUtility(3) +
      0.194 * cloudUtility(25);

    expect(outcome.kind).toBe('scored');
    if (outcome.kind === 'scored') expect(outcome.score).toBeCloseTo(sui * 0.5 * 0.5);
  });

  it('scores 0 when it rains 3 mm', () => {
    expect(skiingOutcome(day({ rain: 3 }))).toEqual({ kind: 'scored', score: 0 });
  });

  it.each(['tMax', 'rain', 'snowfallSum', 'snowDepthMax', 'snowHours', 'cloud', 'windMean'] as const)(
    'is NO_DATA when %s is missing',
    (feature) => {
      expect(skiingOutcome(day({ [feature]: null }))).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
    },
  );

  it('checks for missing data before NO_SNOW', () => {
    expect(skiingOutcome(day({ snowDepthMax: 0, snowfallSum: 0, tMax: null }))).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });

  it.each([
    ['2022-12-02', 0.46],
    ['2023-12-01', 0.13],
    ['2023-12-02', 0.14],
  ])('scores Beaver Creek on %s as %s', (date, expected) => {
    const outcome = skiingOutcome(loadEventFeatures('beaver-creek', date));

    expect(outcome.kind).toBe('scored');
    if (outcome.kind === 'scored') expect(categorize(outcome.score).score).toBe(expected);
  });
});

describe('SkiingScorer', () => {
  const scorer = new SkiingScorer();

  it('declares the skiing activity and the weather source', () => {
    expect(scorer.activity).toBe('SKIING');
    expect(scorer.requiredSources).toEqual(['WEATHER']);
  });

  it('is NO_DATA without weather', () => {
    expect(scorer.evaluate({ weather: null, marine: null })).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('scores a snowy day', () => {
    expect(scorer.evaluate({ weather: snowyDay, marine: null }).kind).toBe('scored');
  });
});
