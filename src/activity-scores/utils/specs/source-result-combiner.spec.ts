import type { SourceResult } from '../../../weather/entities/weather.types.js';
import { SourceResultCombiner } from '../source-result-combiner.js';

const ok: SourceResult<unknown> = {
  status: 'ok',
  data: {},
  fetchedAt: new Date('2026-10-13T10:00:00Z'),
  stale: false,
};
const staleOk: SourceResult<unknown> = { ...ok, stale: true } as SourceResult<unknown>;
const tooOldAt = (fetchedAt: string): SourceResult<unknown> => ({
  status: 'too_old',
  fetchedAt: new Date(fetchedAt),
});
const unavailable = (cause: 'TEMPORARILY_UNAVAILABLE' | 'RATE_LIMITED'): SourceResult<unknown> => ({
  status: 'unavailable',
  cause,
});

describe('SourceResultCombiner', () => {
  const combiner = new SourceResultCombiner();

  describe('one source', () => {
    it('is usable when ok', () => {
      expect(combiner.combine([ok])).toEqual({ status: 'ok' });
    });

    it('is usable when stale but still ok', () => {
      expect(combiner.combine([staleOk])).toEqual({ status: 'ok' });
    });

    it('is too old with the time of the snapshot', () => {
      expect(combiner.combine([tooOldAt('2026-10-11T08:00:00Z')])).toEqual({
        status: 'too_old',
        lastUpdatedAt: new Date('2026-10-11T08:00:00Z'),
      });
    });

    it.each(['TEMPORARILY_UNAVAILABLE', 'RATE_LIMITED'] as const)('is unavailable with cause %s', (cause) => {
      expect(combiner.combine([unavailable(cause)])).toEqual({ status: 'unavailable', cause });
    });
  });

  describe('two sources', () => {
    it('is usable when both are ok', () => {
      expect(combiner.combine([ok, staleOk])).toEqual({ status: 'ok' });
    });

    it('is unavailable when one is unavailable and the other ok', () => {
      expect(combiner.combine([ok, unavailable('TEMPORARILY_UNAVAILABLE')])).toEqual({
        status: 'unavailable',
        cause: 'TEMPORARILY_UNAVAILABLE',
      });
    });

    it('is too old when one is too old and the other ok', () => {
      expect(combiner.combine([tooOldAt('2026-10-11T08:00:00Z'), ok])).toEqual({
        status: 'too_old',
        lastUpdatedAt: new Date('2026-10-11T08:00:00Z'),
      });
    });

    it('is unavailable when one is too old and the other unavailable', () => {
      expect(
        combiner.combine([tooOldAt('2026-10-11T08:00:00Z'), unavailable('TEMPORARILY_UNAVAILABLE')]),
      ).toEqual({
        status: 'unavailable',
        cause: 'TEMPORARILY_UNAVAILABLE',
      });
    });

    it('reports the older time when both are too old', () => {
      const expected = { status: 'too_old', lastUpdatedAt: new Date('2026-10-10T08:00:00Z') };

      expect(combiner.combine([tooOldAt('2026-10-11T08:00:00Z'), tooOldAt('2026-10-10T08:00:00Z')])).toEqual(
        expected,
      );
      expect(combiner.combine([tooOldAt('2026-10-10T08:00:00Z'), tooOldAt('2026-10-11T08:00:00Z')])).toEqual(
        expected,
      );
    });

    it.each([
      [[unavailable('RATE_LIMITED'), ok]],
      [[ok, unavailable('RATE_LIMITED')]],
      [[unavailable('TEMPORARILY_UNAVAILABLE'), unavailable('RATE_LIMITED')]],
    ])('reports RATE_LIMITED when either failure was a 429', (results) => {
      expect(combiner.combine(results)).toEqual({ status: 'unavailable', cause: 'RATE_LIMITED' });
    });
  });
});
