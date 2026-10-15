import { SURFING } from '../entities/activities.js';
import type { DayConditions, MarineDayFeatures } from '../entities/day-features.js';
import { buildMarine, buildWeatherFeatures } from '../../../test/support/builders/day.js';
import { curveOf, scoreDay } from '../../../test/support/scoring-helpers.js';

const weather = buildWeatherFeatures({ maxWindSpeedKmh: 15 });
const waves = buildMarine().features as MarineDayFeatures;

const context = (overrides: Partial<DayConditions> = {}): DayConditions => ({
  weather,
  marine: buildMarine(),
  ...overrides,
});

describe('surfing utilities', () => {
  const waveHeightUtility = curveOf(SURFING, 'maxWaveHeightM');
  const wavePeriodUtility = curveOf(SURFING, 'maxWavePeriodS');
  const windUtility = curveOf(SURFING, 'maxWindSpeedKmh');

  it.each([
    [0.1, 0],
    [0.3, 0],
    [0.55, 0.3],
    [0.8, 0.6],
    [0.9, 0.8],
    [1.0, 1],
    [1.5, 1],
    [2.0, 1],
    [2.5, 0.75],
    [3.0, 0.5],
    [3.5, 0.25],
    [4.0, 0],
    [6, 0],
  ])('wave height %s m gives %s', (height, expected) => {
    expect(waveHeightUtility(height)).toBeCloseTo(expected);
  });

  it.each([
    [3, 0],
    [5, 0],
    [6.5, 0.2],
    [8, 0.4],
    [9, 0.55],
    [10, 0.7],
    [11.5, 0.85],
    [13, 1],
    [18, 1],
  ])('wave period %s s gives %s', (period, expected) => {
    expect(wavePeriodUtility(period)).toBeCloseTo(expected);
  });

  it.each([
    [0, 1],
    [15, 1],
    [20, 0.85],
    [25, 0.7],
    [32.5, 0.5],
    [40, 0.3],
    [47.5, 0.15],
    [55, 0],
    [80, 0],
  ])('maximum wind %s km/h gives %s', (wind, expected) => {
    expect(windUtility(wind)).toBeCloseTo(expected);
  });
});

describe('surfing outcome', () => {
  it('combines the three utilities with exponents 0.35, 0.35 and 0.30', () => {
    const day = context({ marine: { hasSea: true, features: { maxWaveHeightM: 0.8, maxWavePeriodS: 8 } } });
    const expected = 0.6 ** 0.35 * 0.4 ** 0.35 * 1 ** 0.3;

    expect(scoreDay(SURFING, day)).toEqual({ kind: 'scored', score: expect.closeTo(expected, 10) });
  });

  it('scores 1 for ideal conditions', () => {
    expect(scoreDay(SURFING, context())).toEqual({ kind: 'scored', score: 1 });
  });

  it('weights wind with the third exponent', () => {
    const day = context({ weather: { ...weather, maxWindSpeedKmh: 25 } });

    expect(scoreDay(SURFING, day)).toEqual({ kind: 'scored', score: expect.closeTo(0.7 ** 0.3, 10) });
  });

  it.each([0.3, 0.1, 0])('scores 0 when waves are %s m', (maxWaveHeightM) => {
    const day = context({ marine: { hasSea: true, features: { maxWaveHeightM, maxWavePeriodS: 12 } } });

    expect(scoreDay(SURFING, day)).toEqual({ kind: 'scored', score: 0 });
  });

  it('scores 0 when the period is 5 s or less', () => {
    const day = context({ marine: { hasSea: true, features: { maxWaveHeightM: 1.5, maxWavePeriodS: 5 } } });

    expect(scoreDay(SURFING, day)).toEqual({ kind: 'scored', score: 0 });
  });

  it('scores 0 when the wind is 55 km/h or more', () => {
    const day = context({ weather: { ...weather, maxWindSpeedKmh: 55 } });

    expect(scoreDay(SURFING, day)).toEqual({ kind: 'scored', score: 0 });
  });

  it('is NO_SEA when there is no sea', () => {
    expect(scoreDay(SURFING, context({ marine: { hasSea: false, features: null } }))).toEqual({
      kind: 'unscored',
      reason: 'NO_SEA',
    });
  });

  it('is NO_SEA without a sea even when the weather is missing', () => {
    const day = context({ weather: null, marine: { hasSea: false, features: null } });

    expect(scoreDay(SURFING, day)).toEqual({ kind: 'unscored', reason: 'NO_SEA' });
  });

  it('is NO_DATA when the weather is missing', () => {
    expect(scoreDay(SURFING, context({ weather: null }))).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('is NO_DATA when the wind feature is missing', () => {
    expect(scoreDay(SURFING, context({ weather: { ...weather, maxWindSpeedKmh: null } }))).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });

  it('is NO_DATA when the wave features are missing', () => {
    expect(scoreDay(SURFING, context({ marine: { hasSea: true, features: null } }))).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });

  it.each(['maxWaveHeightM', 'maxWavePeriodS'] as const)('is NO_DATA when %s is missing', (feature) => {
    const day = context({ marine: { hasSea: true, features: { ...waves, [feature]: null } } });

    expect(scoreDay(SURFING, day)).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('is NO_DATA when the marine source was not requested', () => {
    expect(scoreDay(SURFING, context({ marine: null }))).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });
});
