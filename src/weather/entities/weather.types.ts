export type LocalDate = string;

export interface LocationRef {
  id: number;
  latE2: number;
  lonE2: number;
  timezone: string;
}

export interface ForecastHour {
  timeUtc: Date;
  temperature2m: number | null;
  relativeHumidity2m: number | null;
  precipitation: number | null;
  rain: number | null;
  snowfall: number | null;
  snowDepth: number | null;
  cloudCover: number | null;
  windSpeed10m: number | null;
  windGusts10m: number | null;
  weatherCode: number | null;
}

export interface ForecastData {
  apiLatitude: number;
  apiLongitude: number;
  elevationM: number | null;
  utcOffsetSeconds: number;
  hours: ForecastHour[];
}

export interface MarineHour {
  timeUtc: Date;
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDirection: number | null;
  swellWaveHeight: number | null;
  swellWavePeriod: number | null;
}

export interface MarineData {
  hasSea: boolean;
  apiLatitude: number | null;
  apiLongitude: number | null;
  hours: MarineHour[];
}

export interface StoredSnapshot<T> {
  id: number;
  fetchedAt: Date;
  data: T;
}

export type SourceFailureCause = 'TEMPORARILY_UNAVAILABLE' | 'RATE_LIMITED';

export type SourceResult<T> =
  | { status: 'ok'; data: T; fetchedAt: Date; stale: boolean }
  | { status: 'too_old'; fetchedAt: Date }
  | { status: 'unavailable'; cause: SourceFailureCause };
