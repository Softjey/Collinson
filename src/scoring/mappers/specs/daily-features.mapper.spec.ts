import type { HourlyMarine, HourlyWeather } from '../../entities/day-features.js';
import { DailyFeaturesMapper } from '../daily-features.mapper.js';

const mapper = new DailyFeaturesMapper();

const unix = (iso: string) => Date.parse(iso) / 1000;

function weatherHour(iso: string, overrides: Partial<HourlyWeather> = {}): HourlyWeather {
  return {
    unixSeconds: unix(iso),
    temperatureC: 10,
    relativeHumidityPercent: 50,
    precipitationMm: 0,
    rainMm: 0,
    snowfallCm: 0,
    snowDepthM: 0,
    cloudCoverPercent: 50,
    windSpeedKmh: 10,
    ...overrides,
  };
}

function hoursOfDay(
  startIso: string,
  count: number,
  overrides: Partial<HourlyWeather> = {},
): HourlyWeather[] {
  const start = unix(startIso);
  return Array.from({ length: count }, (_, i) => ({
    ...weatherHour(startIso, overrides),
    unixSeconds: start + i * 3600,
  }));
}

describe('DailyFeaturesMapper.toWeatherDays', () => {
  it('aggregates every feature of one day', () => {
    const hours = [
      weatherHour('2024-01-10T00:00:00Z', {
        temperatureC: 2,
        relativeHumidityPercent: 80,
        precipitationMm: 1,
        rainMm: 0.5,
        snowfallCm: 0,
        snowDepthM: 0.1,
        cloudCoverPercent: 100,
        windSpeedKmh: 10,
      }),
      weatherHour('2024-01-10T01:00:00Z', {
        temperatureC: 6,
        relativeHumidityPercent: 60,
        precipitationMm: 2,
        rainMm: 1,
        snowfallCm: 0.4,
        snowDepthM: 0.3,
        cloudCoverPercent: 50,
        windSpeedKmh: 30,
      }),
      weatherHour('2024-01-10T02:00:00Z', {
        temperatureC: 4,
        relativeHumidityPercent: 40,
        precipitationMm: 0.5,
        rainMm: 0,
        snowfallCm: 0.2,
        snowDepthM: 0.2,
        cloudCoverPercent: 0,
        windSpeedKmh: 20,
      }),
    ];

    const day = mapper.toWeatherDays(hours, 'UTC').get('2024-01-10');

    expect(day).toMatchObject({
      maxTemperatureC: 6,
      meanRelativeHumidityPercent: 60,
      totalPrecipitationMm: 3.5,
      totalRainMm: 1.5,
      maxSnowDepthM: 0.3,
      snowfallHours: 2,
      meanCloudCoverPercent: 50,
      meanWindSpeedKmh: 20,
      maxWindSpeedKmh: 30,
    });
    expect(day?.totalSnowfallCm).toBeCloseTo(0.6);
  });

  it('groups hours into calendar days of a zone with a positive offset', () => {
    const hours = [
      weatherHour('2024-01-01T14:00:00Z', { temperatureC: 1 }),
      weatherHour('2024-01-01T15:00:00Z', { temperatureC: 9 }),
    ];

    const days = mapper.toWeatherDays(hours, 'Asia/Tokyo');

    expect(days.get('2024-01-01')?.maxTemperatureC).toBe(1);
    expect(days.get('2024-01-02')?.maxTemperatureC).toBe(9);
  });

  it('groups hours into calendar days of a zone with a negative offset', () => {
    const hours = [
      weatherHour('2024-01-02T07:00:00Z', { temperatureC: 1 }),
      weatherHour('2024-01-02T08:00:00Z', { temperatureC: 9 }),
    ];

    const days = mapper.toWeatherDays(hours, 'America/Los_Angeles');

    expect(days.get('2024-01-01')?.maxTemperatureC).toBe(1);
    expect(days.get('2024-01-02')?.maxTemperatureC).toBe(9);
  });

  it('gives a 23 hour day when clocks go forward', () => {
    const hours = hoursOfDay('2024-03-30T23:00:00Z', 48, { snowfallCm: 1 });

    const days = mapper.toWeatherDays(hours, 'Europe/Berlin');

    expect(days.get('2024-03-31')?.snowfallHours).toBe(23);
  });

  it('gives a 25 hour day when clocks go back', () => {
    const hours = hoursOfDay('2024-10-26T22:00:00Z', 48, { snowfallCm: 1 });

    const days = mapper.toWeatherDays(hours, 'Europe/Berlin');

    expect(days.get('2024-10-27')?.snowfallHours).toBe(25);
  });

  it('skips null hourly values when aggregating', () => {
    const hours = [
      weatherHour('2024-01-10T00:00:00Z', { temperatureC: null, windSpeedKmh: 10, snowfallCm: null }),
      weatherHour('2024-01-10T01:00:00Z', { temperatureC: 5, windSpeedKmh: null, snowfallCm: 0.3 }),
      weatherHour('2024-01-10T02:00:00Z', { temperatureC: 3, windSpeedKmh: 30, snowfallCm: 0 }),
    ];

    const day = mapper.toWeatherDays(hours, 'UTC').get('2024-01-10');

    expect(day?.maxTemperatureC).toBe(5);
    expect(day?.meanWindSpeedKmh).toBe(20);
    expect(day?.totalSnowfallCm).toBe(0.3);
    expect(day?.snowfallHours).toBe(1);
  });

  it('gives null features when every hourly value of the day is null', () => {
    const hours = [
      weatherHour('2024-01-10T00:00:00Z', { temperatureC: null, relativeHumidityPercent: null }),
      weatherHour('2024-01-10T01:00:00Z', { temperatureC: null, relativeHumidityPercent: null }),
    ];

    const day = mapper.toWeatherDays(hours, 'UTC').get('2024-01-10');

    expect(day?.maxTemperatureC).toBeNull();
    expect(day?.meanRelativeHumidityPercent).toBeNull();
    expect(day?.maxWindSpeedKmh).toBe(10);
  });

  it('gives null snowfallHours when every snowfall value is null', () => {
    const hours = [weatherHour('2024-01-10T00:00:00Z', { snowfallCm: null })];

    expect(mapper.toWeatherDays(hours, 'UTC').get('2024-01-10')?.snowfallHours).toBeNull();
  });

  it('has no entry for a date without hours', () => {
    const hours = [weatherHour('2024-01-10T00:00:00Z'), weatherHour('2024-01-12T00:00:00Z')];

    const days = mapper.toWeatherDays(hours, 'UTC');

    expect([...days.keys()]).toEqual(['2024-01-10', '2024-01-12']);
    expect(days.has('2024-01-11')).toBe(false);
  });

  it('returns an empty map without hours', () => {
    expect(mapper.toWeatherDays([], 'UTC').size).toBe(0);
  });

  it('rejects an unknown time zone', () => {
    expect(() => mapper.toWeatherDays([weatherHour('2024-01-10T00:00:00Z')], 'Mars/Olympus')).toThrow(
      RangeError,
    );
  });
});

describe('DailyFeaturesMapper.toMarineDays', () => {
  const marineHour = (iso: string, waveHeightM: number | null, wavePeriodS: number | null): HourlyMarine => ({
    unixSeconds: unix(iso),
    waveHeightM,
    wavePeriodS,
  });

  it('takes the maximum wave height and period of the local day', () => {
    const hours = [
      marineHour('2024-01-10T00:00:00Z', 1.2, 8),
      marineHour('2024-01-10T01:00:00Z', 1.8, 7),
      marineHour('2024-01-10T02:00:00Z', null, 11),
    ];

    expect(mapper.toMarineDays(hours, 'UTC').get('2024-01-10')).toEqual({
      maxWaveHeightM: 1.8,
      maxWavePeriodS: 11,
    });
  });

  it('gives null features when every value is null', () => {
    const hours = [marineHour('2024-01-10T00:00:00Z', null, null)];

    expect(mapper.toMarineDays(hours, 'UTC').get('2024-01-10')).toEqual({
      maxWaveHeightM: null,
      maxWavePeriodS: null,
    });
  });

  it('groups by the local calendar day', () => {
    const hours = [marineHour('2024-01-01T14:00:00Z', 1, 5), marineHour('2024-01-01T15:00:00Z', 2, 6)];

    const days = mapper.toMarineDays(hours, 'Asia/Tokyo');

    expect(days.get('2024-01-01')?.maxWaveHeightM).toBe(1);
    expect(days.get('2024-01-02')?.maxWaveHeightM).toBe(2);
  });
});
