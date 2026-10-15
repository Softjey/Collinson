import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MarineResponse } from '../../../shared/open-meteo/schemas/marine.schema.js';
import { MARINE_PARSER_VERSION } from '../../entities/parser-versions.js';
import { MarineMapper } from '../marine.mapper.js';
import type { MarineSnapshotRow } from '../../repositories/marine.repository.js';

function fixture(name: string): Record<string, unknown> & { hourly: Record<string, unknown[]> } {
  const path = fileURLToPath(new URL(`../../../../test/fixtures/weather/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8'));
}

const mapper = new MarineMapper();

describe('MarineMapper.toData', () => {
  it('starts the parser version at 1', () => {
    expect(MARINE_PARSER_VERSION).toBe(1);
  });

  it('maps a coastal response to hasSea with 192 hours', () => {
    const data = mapper.toData(fixture('marine-barcelona') as unknown as MarineResponse);

    expect(data.hasSea).toBe(true);
    expect(data.apiLatitude).toBe(41.375);
    expect(data.apiLongitude).toBe(2.208);
    expect(data.hours).toHaveLength(192);
    expect(data.hours[0]?.timeUtc).toEqual(new Date('2026-10-12T22:00:00Z'));
    expect(data.hours[0]).toMatchObject({ waveHeight: 0.6, waveDirection: 120 });
  });

  it('keeps nulls in individual hours', () => {
    const data = mapper.toData(fixture('marine-barcelona') as unknown as MarineResponse);

    expect(data.hours[10]?.wavePeriod).toBeNull();
    expect(data.hours[10]?.waveHeight).not.toBeNull();
  });

  it('maps an all-null wave height to no sea and no hours', () => {
    const data = mapper.toData(fixture('marine-madrid-inland') as unknown as MarineResponse);

    expect(data.hasSea).toBe(false);
    expect(data.hours).toEqual([]);
  });

  it('keeps hasSea when only some wave heights are null', () => {
    const response = fixture('marine-barcelona');
    response.hourly.wave_height = (response.hourly.wave_height ?? []).map((value, i) =>
      i === 0 ? value : null,
    );
    const data = mapper.toData(response as unknown as MarineResponse);

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
