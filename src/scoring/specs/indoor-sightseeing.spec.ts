import { loadEventFeatures } from '../../../test/fixtures/scoring/load.js';
import { INDOOR_SIGHTSEEING, OUTDOOR_SIGHTSEEING } from '../activity-definitions.js';
import { categorize } from '../category.js';
import type { WeatherDayFeatures } from '../daily-features.js';
import { scoreDay } from '../score-day.js';
import { NO_WEATHER, scoreOf, withWeather } from './helpers.js';

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

const indoor = (overrides: Partial<WeatherDayFeatures> = {}) => withWeather({ ...pleasantDay, ...overrides });

const indoorOf = (overrides: Partial<WeatherDayFeatures> = {}) =>
  scoreOf(INDOOR_SIGHTSEEING, indoor(overrides));

describe('indoor sightseeing', () => {
  it('is 0.5 + 0.5 * (1 - outdoor)', () => {
    const outdoor = scoreOf(OUTDOOR_SIGHTSEEING, indoor());

    expect(indoorOf()).toBeCloseTo(0.5 + 0.5 * (1 - outdoor));
  });

  it('is 1 when the outdoor score is 0', () => {
    const miserable = { tMax: 50, rhMean: 100, precip: 30, windMean: 80, windMax: 100, cloud: 100 };

    expect(indoorOf(miserable)).toBe(1);
  });

  it('stays at 0.5 or above on a perfect day', () => {
    const perfect = { tMax: 24, rhMean: 40, cloud: 15, windMean: 5 };

    expect(indoorOf(perfect)).toBeGreaterThanOrEqual(0.5);
    expect(indoorOf(perfect)).toBeLessThan(0.6);
  });

  it('falls as outdoor rises', () => {
    expect(indoorOf({ precip: 7 })).toBeGreaterThan(indoorOf());
  });

  it('uses the outdoor score after the caps', () => {
    expect(indoorOf({ windMax: 60 })).toBeCloseTo(0.9);
  });

  it('matches the validation events', () => {
    const score = (place: string, date: string) =>
      categorize(scoreOf(INDOOR_SIGHTSEEING, withWeather(loadEventFeatures(place, date)))).score;

    expect(score('hong-kong', '2023-09-01')).toBe(0.9);
    expect(score('hong-kong', '2023-09-02')).toBe(0.96);
    expect(score('london', '2022-02-18')).toBe(0.9);
  });

  it('is NO_DATA without weather', () => {
    expect(scoreDay(INDOOR_SIGHTSEEING, NO_WEATHER)).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('is NO_DATA when outdoor cannot be scored', () => {
    expect(scoreDay(INDOOR_SIGHTSEEING, indoor({ tMax: null }))).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });
});
