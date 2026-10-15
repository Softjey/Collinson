import { loadEventFeatures } from '../../../test/support/scoring-events.js';
import { INDOOR_SIGHTSEEING, OUTDOOR_SIGHTSEEING } from '../entities/activities.js';
import type { WeatherDayFeatures } from '../entities/day-features.js';
import { NO_WEATHER, withWeather } from '../../../test/support/builders/day.js';
import { scoreDay, scoreOf, rate } from '../../../test/support/scoring-helpers.js';

const indoor = (overrides: Partial<WeatherDayFeatures> = {}) => withWeather(overrides);

const indoorOf = (overrides: Partial<WeatherDayFeatures> = {}) =>
  scoreOf(INDOOR_SIGHTSEEING, indoor(overrides));

describe('indoor sightseeing', () => {
  it('is 0.5 + 0.5 * (1 - outdoor)', () => {
    const outdoor = scoreOf(OUTDOOR_SIGHTSEEING, indoor());

    expect(indoorOf()).toBeCloseTo(0.5 + 0.5 * (1 - outdoor));
  });

  it('is 1 when the outdoor score is 0', () => {
    const miserable = {
      maxTemperatureC: 50,
      meanRelativeHumidityPercent: 100,
      totalPrecipitationMm: 30,
      meanWindSpeedKmh: 80,
      maxWindSpeedKmh: 100,
      meanCloudCoverPercent: 100,
    };

    expect(indoorOf(miserable)).toBe(1);
  });

  it('stays at 0.5 or above on a perfect day', () => {
    const perfect = {
      maxTemperatureC: 24,
      meanRelativeHumidityPercent: 40,
      meanCloudCoverPercent: 15,
      meanWindSpeedKmh: 5,
    };

    expect(indoorOf(perfect)).toBeGreaterThanOrEqual(0.5);
    expect(indoorOf(perfect)).toBeLessThan(0.6);
  });

  it('falls as outdoor rises', () => {
    expect(indoorOf({ totalPrecipitationMm: 7 })).toBeGreaterThan(indoorOf());
  });

  it('uses the outdoor score after the caps', () => {
    expect(indoorOf({ maxWindSpeedKmh: 60 })).toBeCloseTo(0.9);
  });

  it('matches the validation events', () => {
    const score = (place: string, date: string) =>
      rate(scoreOf(INDOOR_SIGHTSEEING, withWeather(loadEventFeatures(place, date)))).score;

    expect(score('hong-kong', '2023-09-01')).toBe(0.9);
    expect(score('hong-kong', '2023-09-02')).toBe(0.96);
    expect(score('london', '2022-02-18')).toBe(0.9);
  });

  it('is NO_DATA without weather', () => {
    expect(scoreDay(INDOOR_SIGHTSEEING, NO_WEATHER)).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('is NO_DATA when outdoor cannot be scored', () => {
    expect(scoreDay(INDOOR_SIGHTSEEING, indoor({ maxTemperatureC: null }))).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });
});
