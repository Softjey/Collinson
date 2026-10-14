import { Injectable } from '@nestjs/common';
import { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import type { MarineResponse } from '../shared/open-meteo/schemas/marine.schema.js';
import { fromE2, unixToDate } from './utils/convert.js';
import type { LocationRef, MarineData } from './entities/weather.types.js';

// Bump when the mapping from the Marine response to stored columns changes (new or renamed variable,
// unit change, different rule for hasSea), so rows written by older logic can be told apart.
export const MARINE_PARSER_VERSION = 1;

const HOURLY_VARIABLES = [
  'wave_height',
  'wave_period',
  'wave_direction',
  'swell_wave_height',
  'swell_wave_period',
] as const;

@Injectable()
export class MarineClient {
  constructor(private readonly openMeteo: OpenMeteoService) {}

  async fetch(location: Pick<LocationRef, 'latE2' | 'lonE2' | 'timezone'>): Promise<MarineData> {
    const response = await this.openMeteo.marine({
      latitude: fromE2(location.latE2),
      longitude: fromE2(location.lonE2),
      forecast_days: 8,
      timezone: location.timezone,
      timeformat: 'unixtime',
      cell_selection: 'sea',
      hourly: HOURLY_VARIABLES.join(','),
    });
    return toMarineData(response);
  }
}

function toMarineData(response: MarineResponse): MarineData {
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
