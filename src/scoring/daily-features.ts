export interface HourlyWeather {
  time: number;
  temperature: number | null;
  relativeHumidity: number | null;
  precipitation: number | null;
  rain: number | null;
  snowfall: number | null;
  snowDepth: number | null;
  cloudCover: number | null;
  windSpeed: number | null;
}

export interface HourlyMarine {
  time: number;
  waveHeight: number | null;
  wavePeriod: number | null;
}

export interface WeatherDayFeatures {
  tMax: number | null;
  rhMean: number | null;
  precip: number | null;
  rain: number | null;
  snowfallSum: number | null;
  snowDepthMax: number | null;
  snowHours: number | null;
  cloud: number | null;
  windMean: number | null;
  windMax: number | null;
}

export interface MarineDayFeatures {
  waveHeight: number | null;
  wavePeriod: number | null;
}

type Aggregate = (values: readonly (number | null)[]) => number | null;

const present = (values: readonly (number | null)[]): number[] =>
  values.filter((value): value is number => value !== null);

const sum: Aggregate = (values) => {
  const usable = present(values);
  return usable.length === 0 ? null : usable.reduce((total, value) => total + value, 0);
};

const mean: Aggregate = (values) => {
  const usable = present(values);
  return usable.length === 0 ? null : usable.reduce((total, value) => total + value, 0) / usable.length;
};

const max: Aggregate = (values) => {
  const usable = present(values);
  return usable.length === 0 ? null : Math.max(...usable);
};

const countPositive: Aggregate = (values) => {
  const usable = present(values);
  return usable.length === 0 ? null : usable.filter((value) => value > 0).length;
};

function localDateKey(formatter: Intl.DateTimeFormat, unixSeconds: number): string {
  const parts = formatter.formatToParts(unixSeconds * 1000);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function groupByLocalDay<T extends { time: number }>(
  hours: readonly T[],
  timeZone: string,
): Map<string, T[]> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const days = new Map<string, T[]>();
  for (const hour of hours) {
    const key = localDateKey(formatter, hour.time);
    const day = days.get(key);
    if (day) day.push(hour);
    else days.set(key, [hour]);
  }
  return days;
}

function mapDays<H extends { time: number }, F>(
  hours: readonly H[],
  timeZone: string,
  toFeatures: (day: H[]) => F,
): Map<string, F> {
  const features = new Map<string, F>();
  for (const [date, day] of groupByLocalDay(hours, timeZone)) {
    features.set(date, toFeatures(day));
  }
  return features;
}

export function weatherDailyFeatures(
  hours: readonly HourlyWeather[],
  timeZone: string,
): Map<string, WeatherDayFeatures> {
  return mapDays(hours, timeZone, (day) => {
    const column = (pick: (hour: HourlyWeather) => number | null) => day.map(pick);
    return {
      tMax: max(column((h) => h.temperature)),
      rhMean: mean(column((h) => h.relativeHumidity)),
      precip: sum(column((h) => h.precipitation)),
      rain: sum(column((h) => h.rain)),
      snowfallSum: sum(column((h) => h.snowfall)),
      snowDepthMax: max(column((h) => h.snowDepth)),
      snowHours: countPositive(column((h) => h.snowfall)),
      cloud: mean(column((h) => h.cloudCover)),
      windMean: mean(column((h) => h.windSpeed)),
      windMax: max(column((h) => h.windSpeed)),
    };
  });
}

export function marineDailyFeatures(
  hours: readonly HourlyMarine[],
  timeZone: string,
): Map<string, MarineDayFeatures> {
  return mapDays(hours, timeZone, (day) => ({
    waveHeight: max(day.map((h) => h.waveHeight)),
    wavePeriod: max(day.map((h) => h.wavePeriod)),
  }));
}
