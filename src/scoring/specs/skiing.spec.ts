import { loadEventFeatures } from '../../../test/support/scoring-events.js';
import { SKIING } from '../activities/activities.js';
import type { WeatherDayFeatures } from '../entities/day-features.js';
import { NO_WEATHER, withWeather } from '../../../test/support/builders/day.js';
import { curveOf, scoreDay, scoreOf, rate } from '../../../test/support/scoring-helpers.js';

const snowyDay: Partial<WeatherDayFeatures> = {
  maxTemperatureC: 3,
  meanRelativeHumidityPercent: 70,
  maxSnowDepthM: 0.5,
  meanCloudCoverPercent: 25,
  meanWindSpeedKmh: 0,
  maxWindSpeedKmh: 5,
};

const day = (overrides: Partial<WeatherDayFeatures>) => withWeather({ ...snowyDay, ...overrides });

const snowUtility = curveOf(SKIING, 'snowfallHours');
const windUtility = curveOf(SKIING, 'meanWindSpeedMs');
const temperatureUtility = curveOf(SKIING, 'maxTemperatureC');
const cloudUtility = curveOf(SKIING, 'meanCloudCoverPercent');
const rainMultiplier = curveOf(SKIING, 'totalRainMm');
const depthMultiplier = curveOf(SKIING, 'maxSnowDepthM');

describe('skiing snow utility', () => {
  it('is 0.98 without snowing hours', () => {
    expect(snowUtility(0)).toBe(0.98);
  });

  it('falls with each snowing hour', () => {
    expect(snowUtility(2)).toBe(0.81);
    expect(snowUtility(5)).toBe(0.06);
  });

  it('is 0 from 6 hours', () => {
    expect(snowUtility(6)).toBe(0);
    expect(snowUtility(24)).toBe(0);
  });
});

describe('skiing wind utility', () => {
  it('is 1 in calm air', () => {
    expect(windUtility(0)).toBe(1);
  });

  it('is applied to the mean wind converted from km/h to m/s', () => {
    expect(windUtility(10)).toBe(0.26);
    const windy = scoreOf(SKIING, day({ meanWindSpeedKmh: 36 }));
    const calm = scoreOf(SKIING, day({ meanWindSpeedKmh: 0 }));

    expect(calm - windy).toBeCloseTo(0.279 * (1 - 0.26));
  });

  it('is 0 from 14 m/s', () => {
    expect(windUtility(14)).toBe(0);
    expect(windUtility(100 / 3.6)).toBe(0);
  });
});

describe('skiing temperature utility', () => {
  it('is 1 at the peak at 3 C', () => {
    expect(temperatureUtility(3)).toBe(1);
  });

  it('is never above 1', () => {
    for (let t = -20; t <= 20; t += 0.5) {
      expect(temperatureUtility(t)).toBeLessThanOrEqual(1);
    }
  });

  it('is 0 at and below -12 C', () => {
    expect(temperatureUtility(-12)).toBe(0);
    expect(temperatureUtility(-25)).toBe(0);
  });

  it('is 0 at and above 15 C', () => {
    expect(temperatureUtility(15)).toBe(0);
    expect(temperatureUtility(30)).toBe(0);
  });

  it('falls faster on the warm side than on the cold side', () => {
    expect(temperatureUtility(-2)).toBe(0.56);
    expect(temperatureUtility(10)).toBe(0.35);
  });
});

describe('skiing cloud utility', () => {
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

describe('skiing multipliers', () => {
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

describe('skiing outcome', () => {
  it('is NO_SNOW when depth and snowfall are both 0', () => {
    expect(scoreDay(SKIING, day({ maxSnowDepthM: 0, totalSnowfallCm: 0 }))).toEqual({
      kind: 'unscored',
      reason: 'NO_SNOW',
    });
  });

  it('is scored when only the snow depth is positive', () => {
    expect(scoreDay(SKIING, day({ maxSnowDepthM: 0.4, totalSnowfallCm: 0 })).kind).toBe('scored');
  });

  it('is scored when only the snowfall is positive', () => {
    expect(scoreDay(SKIING, day({ maxSnowDepthM: 0, totalSnowfallCm: 1, snowfallHours: 2 }))).toEqual({
      kind: 'scored',
      score: 0,
    });
  });

  it('combines the weighted utilities with the multipliers', () => {
    const sui =
      0.303 * snowUtility(1) +
      0.279 * windUtility(0) +
      0.222 * temperatureUtility(3) +
      0.194 * cloudUtility(25);

    expect(scoreOf(SKIING, day({ totalRainMm: 1.5, maxSnowDepthM: 0.15, snowfallHours: 1 }))).toBeCloseTo(
      sui * 0.5 * 0.5,
    );
  });

  it('scores 0 when it rains 3 mm', () => {
    expect(scoreDay(SKIING, day({ totalRainMm: 3 }))).toEqual({ kind: 'scored', score: 0 });
  });

  it.each([
    'maxTemperatureC',
    'totalRainMm',
    'totalSnowfallCm',
    'maxSnowDepthM',
    'snowfallHours',
    'meanCloudCoverPercent',
    'meanWindSpeedKmh',
  ] as const)('is NO_DATA when %s is missing', (feature) => {
    expect(scoreDay(SKIING, day({ [feature]: null }))).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('is NO_DATA without weather', () => {
    expect(scoreDay(SKIING, NO_WEATHER)).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('checks for missing data before NO_SNOW', () => {
    expect(scoreDay(SKIING, day({ maxSnowDepthM: 0, totalSnowfallCm: 0, maxTemperatureC: null }))).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });

  it('scores a snowy day', () => {
    expect(scoreDay(SKIING, withWeather(snowyDay)).kind).toBe('scored');
  });

  it.each([
    ['2022-12-02', 0.45],
    ['2023-12-01', 0.13],
    ['2023-12-02', 0.14],
  ])('scores Beaver Creek on %s as %s', (date, expected) => {
    const score = scoreOf(SKIING, withWeather(loadEventFeatures('beaver-creek', date)));

    expect(rate(score).score).toBe(expected);
  });
});
