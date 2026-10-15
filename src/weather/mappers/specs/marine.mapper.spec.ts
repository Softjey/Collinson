import { loadFixture } from '../../../../test/support/fixtures.js';
import type { MarineResponse } from '../../../shared/open-meteo/schemas/marine.schema.js';
import { MarineMapper } from '../marine.mapper.js';
import type { MarineSnapshotRow } from '../../repositories/marine.repository.js';

const mapper = new MarineMapper();
const fixture = (name: 'marine-barcelona' | 'marine-madrid-inland') =>
  loadFixture<MarineResponse>(`weather/${name}.json`);

describe('MarineMapper.toData', () => {
  it('maps a coastal response to hasSea with 192 hours', () => {
    const data = mapper.toData(fixture('marine-barcelona'));

    expect(data.hasSea).toBe(true);
    expect(data.apiLatitude).toBe(41.375);
    expect(data.apiLongitude).toBe(2.208);
    expect(data.hours).toHaveLength(192);
    expect(data.hours[0]?.timeUtc).toEqual(new Date('2026-10-12T22:00:00Z'));
    expect(data.hours[0]).toMatchObject({ waveHeight: 0.6, waveDirection: 120 });
  });

  it('keeps nulls in individual hours', () => {
    const data = mapper.toData(fixture('marine-barcelona'));

    expect(data.hours[10]?.wavePeriod).toBeNull();
    expect(data.hours[10]?.waveHeight).not.toBeNull();
  });

  it('maps an all-null wave height to no sea and no hours', () => {
    const data = mapper.toData(fixture('marine-madrid-inland'));

    expect(data.hasSea).toBe(false);
    expect(data.hours).toEqual([]);
  });

  it('keeps hasSea when only some wave heights are null', () => {
    const response = fixture('marine-barcelona');
    response.hourly.wave_height = (response.hourly.wave_height ?? []).map((value, i) =>
      i === 0 ? value : null,
    );
    const data = mapper.toData(response);

    expect(data.hasSea).toBe(true);
    expect(data.hours).toHaveLength(192);
  });
});

describe('MarineMapper.toStored', () => {
  it('wraps an inland snapshot without hours', () => {
    const fetchedAt = new Date('2026-10-12T20:00:00Z');

    expect(
      mapper.toStored({
        id: 3,
        fetchedAt,
        hasSea: false,
        apiLatitude: null,
        apiLongitude: null,
        hours: [],
      } as unknown as MarineSnapshotRow),
    ).toEqual({
      id: 3,
      fetchedAt,
      data: { hasSea: false, apiLatitude: null, apiLongitude: null, hours: [] },
    } as unknown as MarineSnapshotRow);
  });

  it('drops the snapshot id from the hours', () => {
    const stored = mapper.toStored({
      id: 3,
      fetchedAt: new Date(),
      hasSea: true,
      apiLatitude: 41.3,
      apiLongitude: 2.2,
      hours: [
        {
          snapshotId: 3,
          timeUtc: new Date('2026-10-12T22:00:00Z'),
          waveHeight: 0.6,
          wavePeriod: null,
          waveDirection: 120,
          swellWaveHeight: null,
          swellWavePeriod: null,
        },
      ],
    } as unknown as MarineSnapshotRow);

    expect(stored.data.hours[0]).not.toHaveProperty('snapshotId');
    expect(stored.data.hours[0]).toMatchObject({ waveHeight: 0.6, waveDirection: 120 });
  });
});
