import { buildForecastData, buildMarineData } from '../../../../test/support/builders/weather.js';
import { HourlyDataMapper } from '../hourly-data.mapper.js';

describe('HourlyDataMapper', () => {
  const mapper = new HourlyDataMapper();

  it('maps forecast hours to hourly weather with unix seconds and units in the names', () => {
    const [hour] = buildForecastData({}, 1).hours;

    expect(mapper.toHourlyWeather([hour])).toEqual([
      {
        unixSeconds: hour.timeUtc.getTime() / 1000,
        temperatureC: hour.temperature2m,
        relativeHumidityPercent: 60,
        precipitationMm: 0,
        rainMm: 0,
        snowfallCm: 0,
        snowDepthM: 0,
        cloudCoverPercent: 40,
        windSpeedKmh: 9.5,
      },
    ]);
  });

  it('keeps missing values as null', () => {
    const hours = buildForecastData({}, 6).hours;

    expect(mapper.toHourlyWeather(hours)[5].temperatureC).toBeNull();
  });

  it('maps marine hours to hourly marine', () => {
    const hours = buildMarineData({}, 3).hours;

    expect(mapper.toHourlyMarine(hours)).toEqual([
      { unixSeconds: hours[0].timeUtc.getTime() / 1000, waveHeightM: 1.25, wavePeriodS: 8 },
      { unixSeconds: hours[1].timeUtc.getTime() / 1000, waveHeightM: 1.25, wavePeriodS: 8 },
      { unixSeconds: hours[2].timeUtc.getTime() / 1000, waveHeightM: 1.25, wavePeriodS: null },
    ]);
  });
});
