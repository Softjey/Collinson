import { loadEventFeatures } from '../../../test/fixtures/scoring/load.js';
import { categorize } from '../category.js';
import type { WeatherDayFeatures } from '../daily-features.js';
import { IndoorSightseeingScorer, indoorScore } from './indoor.scorer.js';
import { outdoorScore } from './outdoor.scorer.js';

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

describe('indoorScore', () => {
  it('is 0.5 + 0.5 * (1 - outdoor)', () => {
    const outdoor = outdoorScore(pleasantDay) ?? NaN;

    expect(indoorScore(pleasantDay)).toBeCloseTo(0.5 + 0.5 * (1 - outdoor));
  });

  it('is 1 when the outdoor score is 0', () => {
    const miserable = {
      ...pleasantDay,
      tMax: 50,
      rhMean: 100,
      precip: 30,
      windMean: 80,
      windMax: 100,
      cloud: 100,
    };

    expect(indoorScore(miserable)).toBe(1);
  });

  it('stays at 0.5 or above on a perfect day', () => {
    const perfect = { ...pleasantDay, tMax: 24, rhMean: 40, cloud: 15, windMean: 5 };

    expect(indoorScore(perfect)).toBeGreaterThanOrEqual(0.5);
    expect(indoorScore(perfect)).toBeLessThan(0.6);
  });

  it('falls as outdoor rises', () => {
    const wet = { ...pleasantDay, precip: 7 };

    expect(indoorScore(wet)).toBeGreaterThan(indoorScore(pleasantDay) ?? NaN);
  });

  it('uses the outdoor score after the caps', () => {
    expect(indoorScore({ ...pleasantDay, windMax: 60 })).toBeCloseTo(0.9);
  });

  it('is null only when the outdoor score is null', () => {
    expect(indoorScore({ ...pleasantDay, cloud: null })).toBeNull();
  });

  it('matches the validation events', () => {
    expect(categorize(indoorScore(loadEventFeatures('hong-kong', '2023-09-01')) ?? NaN).score).toBe(0.9);
    expect(categorize(indoorScore(loadEventFeatures('hong-kong', '2023-09-02')) ?? NaN).score).toBe(0.96);
    expect(categorize(indoorScore(loadEventFeatures('london', '2022-02-18')) ?? NaN).score).toBe(0.9);
  });
});

describe('IndoorSightseeingScorer', () => {
  const scorer = new IndoorSightseeingScorer();

  it('declares the indoor activity and the weather source', () => {
    expect(scorer.activity).toBe('INDOOR_SIGHTSEEING');
    expect(scorer.requiredSources).toEqual(['WEATHER']);
  });

  it('scores a day within 0.5 to 1', () => {
    const outcome = scorer.evaluate({ weather: pleasantDay, marine: null });

    expect(outcome.kind).toBe('scored');
    if (outcome.kind === 'scored') {
      expect(outcome.score).toBeGreaterThanOrEqual(0.5);
      expect(outcome.score).toBeLessThanOrEqual(1);
    }
  });

  it('is NO_DATA without weather', () => {
    expect(scorer.evaluate({ weather: null, marine: null })).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('is NO_DATA when outdoor cannot be scored', () => {
    expect(scorer.evaluate({ weather: { ...pleasantDay, tMax: null }, marine: null })).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });
});
