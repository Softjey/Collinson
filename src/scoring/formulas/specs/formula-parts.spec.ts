import { Combiner, Condition, DerivedFeature } from '../formula-parts.js';

describe('Combiner.weightedSum', () => {
  const terms = [
    { utility: 0.5, weight: 2 },
    { utility: 1, weight: 1 },
  ];

  it('adds weight * utility and divides', () => {
    expect(Combiner.weightedSum().combine(terms)).toBe(1);
    expect(Combiner.weightedSum({ divisor: 4 }).combine(terms)).toBeCloseTo(0.5);
  });

  it('clamps to 0..1', () => {
    expect(Combiner.weightedSum().combine([{ utility: 1, weight: 5 }])).toBe(1);
    expect(Combiner.weightedSum({ divisor: 10 }).combine([{ utility: -3, weight: 4 }])).toBe(0);
  });
});

describe('Combiner.weightedProduct', () => {
  it('multiplies utility ^ weight', () => {
    const terms = [
      { utility: 0.25, weight: 0.5 },
      { utility: 0.5, weight: 1 },
    ];

    expect(Combiner.weightedProduct().combine(terms)).toBeCloseTo(0.25);
  });

  it('is 0 when any utility is 0', () => {
    const terms = [
      { utility: 0, weight: 0.35 },
      { utility: 1, weight: 0.35 },
    ];

    expect(Combiner.weightedProduct().combine(terms)).toBe(0);
  });
});

describe('Condition', () => {
  const features = { maxTemperatureC: 5, totalRainMm: 0, maxSnowDepthM: null };

  it('anyMissing holds when a named feature is null or absent', () => {
    expect(Condition.anyMissing('maxSnowDepthM').holdsFor(features)).toBe(true);
    expect(Condition.anyMissing('totalSnowfallCm').holdsFor(features)).toBe(true);
    expect(Condition.anyMissing('maxTemperatureC', 'totalRainMm').holdsFor(features)).toBe(false);
  });

  it('equals and atLeast compare present values', () => {
    expect(Condition.equals('totalRainMm', 0).holdsFor(features)).toBe(true);
    expect(Condition.equals('totalRainMm', 1).holdsFor(features)).toBe(false);
    expect(Condition.atLeast('maxTemperatureC', 5).holdsFor(features)).toBe(true);
    expect(Condition.atLeast('maxTemperatureC', 5.01).holdsFor(features)).toBe(false);
  });

  it('never holds for a comparison on a missing feature', () => {
    expect(Condition.equals('maxSnowDepthM', 0).holdsFor(features)).toBe(false);
    expect(Condition.atLeast('totalSnowfallCm', 0).holdsFor(features)).toBe(false);
  });

  it('allOf needs every condition and anyOf needs one', () => {
    const rainless = Condition.equals('totalRainMm', 0);
    const hot = Condition.atLeast('maxTemperatureC', 30);

    expect(Condition.allOf(rainless, hot).holdsFor(features)).toBe(false);
    expect(Condition.anyOf(rainless, hot).holdsFor(features)).toBe(true);
    expect(Condition.anyOf(hot, hot).holdsFor(features)).toBe(false);
  });
});

describe('DerivedFeature.humidex', () => {
  const humidexOf = (temperature: number, relativeHumidity: number) =>
    DerivedFeature.humidex({
      temperature: 'maxTemperatureC',
      relativeHumidity: 'meanRelativeHumidityPercent',
    }).computeFrom({ maxTemperatureC: temperature, meanRelativeHumidityPercent: relativeHumidity });

  it('is computed from temperature and relative humidity', () => {
    expect(humidexOf(0, 0)).toBeCloseTo(-5.56, 1);
    expect(humidexOf(20, 50)).toBeCloseTo(20.93, 1);
    expect(humidexOf(30, 70)).toBeCloseTo(40.9, 1);
  });

  it('gives a dry heat value of 47.8 at 42 C and 25%', () => {
    expect(humidexOf(42, 25)).toBeCloseTo(47.8, 1);
  });

  it('gives 50.9 for the humid tropics at 32.8 C and 86%', () => {
    expect(humidexOf(32.8, 86)).toBeCloseTo(50.9, 0);
  });

  it('is missing when an input is missing', () => {
    const humidex = DerivedFeature.humidex({
      temperature: 'maxTemperatureC',
      relativeHumidity: 'meanRelativeHumidityPercent',
    });

    expect(humidex.computeFrom({ maxTemperatureC: 20, meanRelativeHumidityPercent: null })).toBeNull();
    expect(humidex.computeFrom({ maxTemperatureC: 20 })).toBeNull();
  });
});

describe('DerivedFeature.quotient', () => {
  const windInMetresPerSecond = DerivedFeature.quotient({ of: 'meanWindSpeedKmh', dividedBy: 3.6 });

  it('divides a feature by a constant', () => {
    expect(windInMetresPerSecond.computeFrom({ meanWindSpeedKmh: 36 })).toBe(10);
  });

  it('is missing when the dividend is missing', () => {
    expect(windInMetresPerSecond.computeFrom({ meanWindSpeedKmh: null })).toBeNull();
  });
});
