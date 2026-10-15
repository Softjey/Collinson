import type { MarineHour as MarineHourRow } from '../../generated/prisma/client.js';
import type { MarineResponse } from '../../shared/open-meteo/schemas/marine.schema.js';
import type { MarineData, StoredSnapshot } from '../entities/weather.types.js';
import { unixToDate } from './convert.js';

// Bump when the mapping from the Marine response to stored columns changes (new or renamed variable,
// unit change, different rule for hasSea), so rows written by older logic can be told apart.
export const MARINE_PARSER_VERSION = 1;

export function toMarineData(response: MarineResponse): MarineData {
  const { hourly } = response;
  const hasSea = hourly.wave_height.some((value) => value !== null);
  return {
    hasSea,
    apiLatitude: response.latitude,
    apiLongitude: response.longitude,
    hours: hasSea
      ? hourly.time.map((seconds, i) => {
          const direction = hourly.wave_direction[i] ?? null;
          return {
            timeUtc: unixToDate(seconds),
            waveHeight: hourly.wave_height[i] ?? null,
            wavePeriod: hourly.wave_period[i] ?? null,
            waveDirection: direction === null ? null : Math.round(direction),
            swellWaveHeight: hourly.swell_wave_height[i] ?? null,
            swellWavePeriod: hourly.swell_wave_period[i] ?? null,
          };
        })
      : [],
  };
}

export interface MarineSnapshotRow {
  id: number;
  fetchedAt: Date;
  hasSea: boolean;
  apiLatitude: number | null;
  apiLongitude: number | null;
  hours: MarineHourRow[];
}

export const toStoredMarine = (row: MarineSnapshotRow): StoredSnapshot<MarineData> => ({
  id: row.id,
  fetchedAt: row.fetchedAt,
  data: {
    hasSea: row.hasSea,
    apiLatitude: row.apiLatitude,
    apiLongitude: row.apiLongitude,
    hours: row.hours.map(({ snapshotId: _snapshotId, ...hour }) => hour),
  },
});
