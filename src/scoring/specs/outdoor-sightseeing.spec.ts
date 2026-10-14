import { loadEventFeatures } from '../../../test/fixtures/scoring/load.js';
import { OUTDOOR_SIGHTSEEING } from '../activity-definitions.js';
import { categorize } from '../category.js';
import type { WeatherDayFeatures } from '../daily-features.js';
import { scoreDay } from '../score-day.js';
import { curveOf, NO_WEATHER, scoreOf, withoutCaps, withWeather } from './helpers.js';

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

const day = (overrides: Partial<WeatherDayFeatures>) => withWeather({ ...pleasantDay, ...overrides });

const outdoor = (overrides: Partial<WeatherDayFeatures> = {}) => scoreOf(OUTDOOR_SIGHTSEEING, day(overrides));
const holidayClimateIndex = (overrides: Partial<WeatherDayFeatures> = {}) =>
  scoreOf(withoutCaps(OUTDOOR_SIGHTSEEING), day(overrides));

describe('outdoor rating tables', () => {
  const thermalComfortRating = curveOf(OUTDOOR_SIGHTSEEING, 'humidex');
  const cloudRating = curveOf(OUTDOOR_SIGHTSEEING, 'cloud');
  const precipitationRating = curveOf(OUTDOOR_SIGHTSEEING, 'precip');
  const windRating = curveOf(OUTDOOR_SIGHTSEEING, 'windMean');

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

describe('holiday climate index', () => {
  it('weights the ratings 4, 2, 3 and 1', () => {
    expect(holidayClimateIndex()).toBeCloseTo(0.99);
  });

  it('never goes below 0 when ratings are negative', () => {
    const storm = { tMax: 50, rhMean: 100, cloud: 100, precip: 30, windMean: 80, windMax: 100 };

    expect(holidayClimateIndex(storm)).toBe(0);
  });

  it('never goes above 1', () => {
    expect(holidayClimateIndex({ tMax: 24, rhMean: 40, cloud: 15, windMean: 5 })).toBeLessThanOrEqual(1);
  });
});

describe('outdoor caps', () => {
  it('does not cap 5.99 mm of precipitation', () => {
    expect(outdoor({ precip: 5.99 })).toBeCloseTo(0.93);
  });

  it('caps 6 mm of precipitation at 0.5', () => {
    expect(outdoor({ precip: 6 })).toBe(0.5);
  });

  it('does not cap a maximum wind of 59.9 km/h', () => {
    expect(outdoor({ windMax: 59.9 })).toBeCloseTo(0.99);
  });

  it('caps a maximum wind of 60 km/h at 0.2', () => {
    expect(outdoor({ windMax: 60 })).toBe(0.2);
  });

  it('caps 25 mm of precipitation at 0.2', () => {
    expect(outdoor({ precip: 25 })).toBe(0.2);
  });

  it('leaves a score that is already below the cap unchanged', () => {
    const gloomy = { tMax: 5, cloud: 100, precip: 6 };

    expect(holidayClimateIndex(gloomy)).toBeCloseTo(0.38);
    expect(outdoor(gloomy)).toBeCloseTo(0.38);
  });
});

describe('outdoor data', () => {
  it.each(['tMax', 'rhMean', 'precip', 'cloud', 'windMean', 'windMax'] as const)(
    'is NO_DATA when %s is missing',
    (feature) => {
      expect(scoreDay(OUTDOOR_SIGHTSEEING, day({ [feature]: null }))).toEqual({
        kind: 'unscored',
        reason: 'NO_DATA',
      });
    },
  );

  it('is NO_DATA without weather', () => {
    expect(scoreDay(OUTDOOR_SIGHTSEEING, NO_WEATHER)).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('does not need snow features', () => {
    expect(scoreDay(OUTDOOR_SIGHTSEEING, day({ snowDepthMax: null, snowHours: null, rain: null })).kind).toBe(
      'scored',
    );
  });
});

describe('outdoor scoring of the dated events', () => {
  it('scores London on 2022-02-18 0.63 before the caps and 0.20 after', () => {
    const london = withWeather(loadEventFeatures('london', '2022-02-18'));

    expect(categorize(scoreOf(withoutCaps(OUTDOOR_SIGHTSEEING), london)).score).toBe(0.63);
    expect(categorize(scoreOf(OUTDOOR_SIGHTSEEING, london)).score).toBe(0.2);
  });

  it('scores Hong Kong on 2023-09-01 0.23 before the caps and 0.20 after', () => {
    const hongKong = withWeather(loadEventFeatures('hong-kong', '2023-09-01'));

    expect(categorize(scoreOf(withoutCaps(OUTDOOR_SIGHTSEEING), hongKong)).score).toBe(0.23);
    expect(categorize(scoreOf(OUTDOOR_SIGHTSEEING, hongKong)).score).toBe(0.2);
  });

  it('scores Hong Kong on 2023-09-02 below 0.10', () => {
    const hongKong = withWeather(loadEventFeatures('hong-kong', '2023-09-02'));

    expect(scoreOf(OUTDOOR_SIGHTSEEING, hongKong)).toBeLessThan(0.1);
  });
});
