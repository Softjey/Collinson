import type { ForecastHour as ForecastHourRow } from '../../generated/prisma/client.js';
import type { ForecastResponse } from '../../shared/open-meteo/schemas/forecast.schema.js';
import type { ForecastData, StoredSnapshot } from '../entities/weather.types.js';
import { unixToDate } from './convert.js';

// Bump when the mapping from the Forecast response to stored columns changes (new or renamed variable,
// unit change, different time handling), so rows written by older logic can be told apart.
export const FORECAST_PARSER_VERSION = 1;

export function toForecastData(response: ForecastResponse): ForecastData {
  const { hourly } = response;
  return {
    apiLatitude: response.latitude,
    apiLongitude: response.longitude,
    elevationM: response.elevation ?? null,
    utcOffsetSeconds: response.utc_offset_seconds,
    hours: hourly.time.map((seconds, i) => ({
      timeUtc: unixToDate(seconds),
      temperature2m: hourly.temperature_2m[i] ?? null,
      relativeHumidity2m: hourly.relative_humidity_2m[i] ?? null,
      precipitation: hourly.precipitation[i] ?? null,
      rain: hourly.rain[i] ?? null,
      snowfall: hourly.snowfall[i] ?? null,
      snowDepth: hourly.snow_depth[i] ?? null,
      cloudCover: hourly.cloud_cover[i] ?? null,
      windSpeed10m: hourly.wind_speed_10m[i] ?? null,
      windGusts10m: hourly.wind_gusts_10m[i] ?? null,
      weatherCode: hourly.weather_code[i] ?? null,
    })),
  };
}

export interface ForecastSnapshotRow {
  id: number;
  fetchedAt: Date;
  apiLatitude: number;
  apiLongitude: number;
  elevationM: number | null;
  utcOffsetSeconds: number;
  hours: ForecastHourRow[];
}

export const toStoredForecast = (row: ForecastSnapshotRow): StoredSnapshot<ForecastData> => ({
  id: row.id,
  fetchedAt: row.fetchedAt,
  data: {
    apiLatitude: row.apiLatitude,
    apiLongitude: row.apiLongitude,
    elevationM: row.elevationM,
    utcOffsetSeconds: row.utcOffsetSeconds,
    hours: row.hours.map(({ snapshotId: _snapshotId, ...hour }) => hour),
  },
});
