import { Injectable } from '@nestjs/common';
import type { MarineResponse } from '../../shared/open-meteo/schemas/marine.schema.js';
import type { MarineData, StoredSnapshot } from '../entities/weather.types.js';
import type { MarineSnapshotRow } from '../repositories/marine.repository.js';
import { unixToDate } from '../../shared/unix-time.js';

@Injectable()
export class MarineMapper {
  toData(response: MarineResponse): MarineData {
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

  toStored(row: MarineSnapshotRow): StoredSnapshot<MarineData> {
    return {
      id: row.id,
      fetchedAt: row.fetchedAt,
      data: {
        hasSea: row.hasSea,
        apiLatitude: row.apiLatitude,
        apiLongitude: row.apiLongitude,
        hours: row.hours.map(({ snapshotId: _snapshotId, ...hour }) => hour),
      },
    };
  }
}
