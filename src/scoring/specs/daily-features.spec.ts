import {
  marineDailyFeatures,
  weatherDailyFeatures,
  type HourlyMarine,
  type HourlyWeather,
} from '.././daily-features.js';

const unix = (iso: string) => Date.parse(iso) / 1000;

function weatherHour(iso: string, overrides: Partial<HourlyWeather> = {}): HourlyWeather {
  return {
    time: unix(iso),
    temperature: 10,
    relativeHumidity: 50,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    snowDepth: 0,
    cloudCover: 50,
    windSpeed: 10,
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
    time: start + i * 3600,
  }));
}

describe('weatherDailyFeatures', () => {
  it('aggregates every feature of one day', () => {
    const hours = [
      weatherHour('2024-01-10T00:00:00Z', {
        temperature: 2,
        relativeHumidity: 80,
        precipitation: 1,
        rain: 0.5,
        snowfall: 0,
        snowDepth: 0.1,
        cloudCover: 100,
        windSpeed: 10,
      }),
      weatherHour('2024-01-10T01:00:00Z', {
        temperature: 6,
        relativeHumidity: 60,
        precipitation: 2,
        rain: 1,
        snowfall: 0.4,
        snowDepth: 0.3,
        cloudCover: 50,
        windSpeed: 30,
      }),
      weatherHour('2024-01-10T02:00:00Z', {
        temperature: 4,
        relativeHumidity: 40,
        precipitation: 0.5,
        rain: 0,
        snowfall: 0.2,
        snowDepth: 0.2,
        cloudCover: 0,
        windSpeed: 20,
      }),
    ];

    const day = weatherDailyFeatures(hours, 'UTC').get('2024-01-10');

    expect(day).toMatchObject({
      tMax: 6,
      rhMean: 60,
      precip: 3.5,
      rain: 1.5,
      snowDepthMax: 0.3,
      snowHours: 2,
      cloud: 50,
      windMean: 20,
      windMax: 30,
    });
    expect(day?.snowfallSum).toBeCloseTo(0.6);
  });

  it('groups hours into calendar days of a zone with a positive offset', () => {
    const hours = [
      weatherHour('2024-01-01T14:00:00Z', { temperature: 1 }),
      weatherHour('2024-01-01T15:00:00Z', { temperature: 9 }),
    ];

    const days = weatherDailyFeatures(hours, 'Asia/Tokyo');

    expect(days.get('2024-01-01')?.tMax).toBe(1);
    expect(days.get('2024-01-02')?.tMax).toBe(9);
  });

  it('groups hours into calendar days of a zone with a negative offset', () => {
    const hours = [
      weatherHour('2024-01-02T07:00:00Z', { temperature: 1 }),
      weatherHour('2024-01-02T08:00:00Z', { temperature: 9 }),
    ];

    const days = weatherDailyFeatures(hours, 'America/Los_Angeles');

    expect(days.get('2024-01-01')?.tMax).toBe(1);
    expect(days.get('2024-01-02')?.tMax).toBe(9);
  });

  it('gives a 23 hour day when clocks go forward', () => {
    const hours = hoursOfDay('2024-03-30T23:00:00Z', 48, { snowfall: 1 });

    const days = weatherDailyFeatures(hours, 'Europe/Berlin');

    expect(days.get('2024-03-31')?.snowHours).toBe(23);
  });

  it('gives a 25 hour day when clocks go back', () => {
    const hours = hoursOfDay('2024-10-26T22:00:00Z', 48, { snowfall: 1 });

    const days = weatherDailyFeatures(hours, 'Europe/Berlin');

    expect(days.get('2024-10-27')?.snowHours).toBe(25);
  });

  it('skips null hourly values when aggregating', () => {
    const hours = [
      weatherHour('2024-01-10T00:00:00Z', { temperature: null, windSpeed: 10, snowfall: null }),
      weatherHour('2024-01-10T01:00:00Z', { temperature: 5, windSpeed: null, snowfall: 0.3 }),
      weatherHour('2024-01-10T02:00:00Z', { temperature: 3, windSpeed: 30, snowfall: 0 }),
    ];

    const day = weatherDailyFeatures(hours, 'UTC').get('2024-01-10');

    expect(day?.tMax).toBe(5);
    expect(day?.windMean).toBe(20);
    expect(day?.snowfallSum).toBe(0.3);
    expect(day?.snowHours).toBe(1);
  });

  it('gives null features when every hourly value of the day is null', () => {
    const hours = [
      weatherHour('2024-01-10T00:00:00Z', { temperature: null, relativeHumidity: null }),
      weatherHour('2024-01-10T01:00:00Z', { temperature: null, relativeHumidity: null }),
    ];

    const day = weatherDailyFeatures(hours, 'UTC').get('2024-01-10');

    expect(day?.tMax).toBeNull();
    expect(day?.rhMean).toBeNull();
    expect(day?.windMax).toBe(10);
  });

  it('gives null snowHours when every snowfall value is null', () => {
    const hours = [weatherHour('2024-01-10T00:00:00Z', { snowfall: null })];

    expect(weatherDailyFeatures(hours, 'UTC').get('2024-01-10')?.snowHours).toBeNull();
  });

  it('has no entry for a date without hours', () => {
    const hours = [weatherHour('2024-01-10T00:00:00Z'), weatherHour('2024-01-12T00:00:00Z')];

    const days = weatherDailyFeatures(hours, 'UTC');

    expect([...days.keys()]).toEqual(['2024-01-10', '2024-01-12']);
    expect(days.has('2024-01-11')).toBe(false);
  });

  it('returns an empty map without hours', () => {
    expect(weatherDailyFeatures([], 'UTC').size).toBe(0);
  });

  it('rejects an unknown time zone', () => {
    expect(() => weatherDailyFeatures([weatherHour('2024-01-10T00:00:00Z')], 'Mars/Olympus')).toThrow(
      RangeError,
    );
  });
});

describe('marineDailyFeatures', () => {
  const marineHour = (iso: string, waveHeight: number | null, wavePeriod: number | null): HourlyMarine => ({
    time: unix(iso),
    waveHeight,
    wavePeriod,
  });

  it('takes the maximum wave height and period of the local day', () => {
    const hours = [
      marineHour('2024-01-10T00:00:00Z', 1.2, 8),
      marineHour('2024-01-10T01:00:00Z', 1.8, 7),
      marineHour('2024-01-10T02:00:00Z', null, 11),
    ];

    expect(marineDailyFeatures(hours, 'UTC').get('2024-01-10')).toEqual({ waveHeight: 1.8, wavePeriod: 11 });
  });

  it('gives null features when every value is null', () => {
    const hours = [marineHour('2024-01-10T00:00:00Z', null, null)];

    expect(marineDailyFeatures(hours, 'UTC').get('2024-01-10')).toEqual({
      waveHeight: null,
      wavePeriod: null,
    });
  });

  it('groups by the local calendar day', () => {
    const hours = [marineHour('2024-01-01T14:00:00Z', 1, 5), marineHour('2024-01-01T15:00:00Z', 2, 6)];

    const days = marineDailyFeatures(hours, 'Asia/Tokyo');

    expect(days.get('2024-01-01')?.waveHeight).toBe(1);
    expect(days.get('2024-01-02')?.waveHeight).toBe(2);
  });
});
