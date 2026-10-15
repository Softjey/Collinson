import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ForecastResponse } from '../../../shared/open-meteo/schemas/forecast.schema.js';
import { PARSER_VERSIONS } from '../../utils/parser-versions.js';
import { ForecastMapper } from '../forecast.mapper.js';
import type { ForecastSnapshotRow } from '../../repositories/forecast.repository.js';

function fixture(): Record<string, unknown> & { hourly: Record<string, unknown[]> } {
  const path = fileURLToPath(
    new URL('../../../../test/fixtures/weather/forecast-barcelona.json', import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf8'));
}

const mapper = new ForecastMapper();

describe('ForecastMapper.toData', () => {
  it('starts the parser version at 1', () => {
    expect(PARSER_VERSIONS.forecast).toBe(1);
  });

  it('maps 192 hours to rows with UTC instants', () => {
    const data = mapper.toData(fixture() as unknown as ForecastResponse);

    expect(data.hours).toHaveLength(192);
    expect(data.hours[0]?.timeUtc).toEqual(new Date('2026-10-12T22:00:00Z'));
    expect(data.hours[191]?.timeUtc).toEqual(new Date('2026-10-20T21:00:00Z'));
    expect(data.hours[1]).toMatchObject({ relativeHumidity2m: 63, weatherCode: 1 });
  });

  it('maps the grid point, elevation and offset', () => {
    const data = mapper.toData(fixture() as unknown as ForecastResponse);

    expect(data).toMatchObject({
      apiLatitude: 41.4,
      apiLongitude: 2.18,
      elevationM: 12,
      utcOffsetSeconds: 7200,
    });
  });

  it('keeps nulls as null', () => {
    const data = mapper.toData(fixture() as unknown as ForecastResponse);

    expect(data.hours[5]?.temperature2m).toBeNull();
    expect(data.hours[191]?.snowDepth).toBeNull();
    expect(data.hours[4]?.temperature2m).not.toBeNull();
  });

  it('maps a missing elevation to null', () => {
    const response = fixture();
    delete response.elevation;
    expect(mapper.toData(response as unknown as ForecastResponse)).toMatchObject({ elevationM: null });
  });
});

describe('ForecastMapper.toStored', () => {
  const hour = {
    snapshotId: 7,
    timeUtc: new Date('2026-10-12T22:00:00Z'),
    temperature2m: 1,
    relativeHumidity2m: null,
    precipitation: null,
    rain: null,
    snowfall: null,
    snowDepth: null,
    cloudCover: null,
    windSpeed10m: null,
    windGusts10m: null,
    weatherCode: null,
  };

  it('wraps the snapshot and drops the snapshot id from the hours', () => {
    const fetchedAt = new Date('2026-10-12T20:00:00Z');

    const stored = mapper.toStored({
      id: 7,
      fetchedAt,
      apiLatitude: 41.4,
      apiLongitude: 2.2,
      elevationM: 12,
      utcOffsetSeconds: 7200,
      hours: [hour],
    } as unknown as ForecastSnapshotRow);

    expect(stored).toMatchObject({ id: 7, fetchedAt, data: { apiLatitude: 41.4, elevationM: 12 } });
    expect(stored.data.hours).toHaveLength(1);
    expect(stored.data.hours[0]).not.toHaveProperty('snapshotId');
    expect(stored.data.hours[0]).toMatchObject({ temperature2m: 1 });
  });
});
