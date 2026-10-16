import { Injectable } from '@nestjs/common';
import type { HourlyMarine, HourlyWeather } from '../../scoring/entities/day-features.js';
import type { ForecastHour, MarineHour } from '../../weather/entities/weather.types.js';

/** Translates stored hourly weather into the hourly shapes the scoring module reads. */
@Injectable()
export class HourlyDataMapper {
  toHourlyWeather(hours: readonly ForecastHour[]): HourlyWeather[] {
    return hours.map((hour) => ({
      unixSeconds: hour.timeUtc.getTime() / 1000,
      temperatureC: hour.temperature2m,
      relativeHumidityPercent: hour.relativeHumidity2m,
      precipitationMm: hour.precipitation,
      rainMm: hour.rain,
      snowfallCm: hour.snowfall,
      snowDepthM: hour.snowDepth,
      cloudCoverPercent: hour.cloudCover,
      windSpeedKmh: hour.windSpeed10m,
    }));
  }

  toHourlyMarine(hours: readonly MarineHour[]): HourlyMarine[] {
    return hours.map((hour) => ({
      unixSeconds: hour.timeUtc.getTime() / 1000,
      waveHeightM: hour.waveHeight,
      wavePeriodS: hour.wavePeriod,
    }));
  }
}
