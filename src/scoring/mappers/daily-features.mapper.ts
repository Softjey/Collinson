import { Injectable } from '@nestjs/common';
import type {
  HourlyMarine,
  HourlyWeather,
  MarineDayFeatures,
  WeatherDayFeatures,
} from '../entities/day-features.js';

/** The values of one measurement over the hours of a day, some of which may be missing. */
class HourlyValues {
  private readonly present: number[];

  constructor(values: readonly (number | null)[]) {
    this.present = values.filter((value): value is number => value !== null);
  }

  max(): number | null {
    return this.isEmpty() ? null : Math.max(...this.present);
  }

  mean(): number | null {
    return this.isEmpty() ? null : this.total() / this.present.length;
  }

  sum(): number | null {
    return this.isEmpty() ? null : this.total();
  }

  countPositive(): number | null {
    return this.isEmpty() ? null : this.present.filter((value) => value > 0).length;
  }

  private isEmpty(): boolean {
    return this.present.length === 0;
  }

  private total(): number {
    return this.present.reduce((sum, value) => sum + value, 0);
  }
}

/** Summarises hourly values into one set of features per calendar day of a time zone. */
@Injectable()
export class DailyFeaturesMapper {
  toWeatherDays(hours: readonly HourlyWeather[], timeZone: string): Map<string, WeatherDayFeatures> {
    return this.mapEachDay(hours, timeZone, (day) => {
      const column = (read: (hour: HourlyWeather) => number | null) => new HourlyValues(day.map(read));
      return {
        maxTemperatureC: column((hour) => hour.temperatureC).max(),
        meanRelativeHumidityPercent: column((hour) => hour.relativeHumidityPercent).mean(),
        totalPrecipitationMm: column((hour) => hour.precipitationMm).sum(),
        totalRainMm: column((hour) => hour.rainMm).sum(),
        totalSnowfallCm: column((hour) => hour.snowfallCm).sum(),
        maxSnowDepthM: column((hour) => hour.snowDepthM).max(),
        snowfallHours: column((hour) => hour.snowfallCm).countPositive(),
        meanCloudCoverPercent: column((hour) => hour.cloudCoverPercent).mean(),
        meanWindSpeedKmh: column((hour) => hour.windSpeedKmh).mean(),
        maxWindSpeedKmh: column((hour) => hour.windSpeedKmh).max(),
      };
    });
  }

  toMarineDays(hours: readonly HourlyMarine[], timeZone: string): Map<string, MarineDayFeatures> {
    return this.mapEachDay(hours, timeZone, (day) => ({
      maxWaveHeightM: new HourlyValues(day.map((hour) => hour.waveHeightM)).max(),
      maxWavePeriodS: new HourlyValues(day.map((hour) => hour.wavePeriodS)).max(),
    }));
  }

  private mapEachDay<Hour extends { unixSeconds: number }, Features>(
    hours: readonly Hour[],
    timeZone: string,
    summarise: (hoursOfDay: Hour[]) => Features,
  ): Map<string, Features> {
    const featuresByDate = new Map<string, Features>();
    for (const [date, hoursOfDay] of this.groupByLocalDate(hours, timeZone)) {
      featuresByDate.set(date, summarise(hoursOfDay));
    }
    return featuresByDate;
  }

  private groupByLocalDate<Hour extends { unixSeconds: number }>(
    hours: readonly Hour[],
    timeZone: string,
  ): Map<string, Hour[]> {
    const dateFormat = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const hoursByDate = new Map<string, Hour[]>();
    for (const hour of hours) {
      const date = this.localDateOf(dateFormat, hour.unixSeconds);
      hoursByDate.set(date, [...(hoursByDate.get(date) ?? []), hour]);
    }
    return hoursByDate;
  }

  private localDateOf(dateFormat: Intl.DateTimeFormat, unixSeconds: number): string {
    const parts = dateFormat.formatToParts(unixSeconds * 1000);
    const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
}
