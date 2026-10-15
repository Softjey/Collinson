import { loadFixture } from '../../../../test/support/fixtures.js';
import type { ForecastResponse } from '../../../shared/open-meteo/schemas/forecast.schema.js';
import { ForecastMapper } from '../forecast.mapper.js';
import type { ForecastSnapshotRow } from '../../repositories/forecast.repository.js';

const mapper = new ForecastMapper();
const fixture = () => loadFixture<ForecastResponse>('weather/forecast-barcelona.json');

describe('ForecastMapper.toData', () => {
  it('maps 192 hours to rows with UTC instants', () => {
    const data = mapper.toData(fixture());

    expect(data.hours).toHaveLength(192);
    expect(data.hours[0]?.timeUtc).toEqual(new Date('2026-10-12T22:00:00Z'));
    expect(data.hours[191]?.timeUtc).toEqual(new Date('2026-10-20T21:00:00Z'));
    expect(data.hours[1]).toMatchObject({ relativeHumidity2m: 63, weatherCode: 1 });
  });

  it('maps the grid point, elevation and offset', () => {
    const data = mapper.toData(fixture());

    expect(data).toMatchObject({
      apiLatitude: 41.4,
      apiLongitude: 2.18,
      elevationM: 12,
      utcOffsetSeconds: 7200,
    });
  });

  it('keeps nulls as null', () => {
    const data = mapper.toData(fixture());

    expect(data.hours[5]?.temperature2m).toBeNull();
    expect(data.hours[191]?.snowDepth).toBeNull();
    expect(data.hours[4]?.temperature2m).not.toBeNull();
  });

  it('maps a missing elevation to null', () => {
    const response = fixture();
    delete response.elevation;
    expect(mapper.toData(response)).toMatchObject({ elevationM: null });
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
