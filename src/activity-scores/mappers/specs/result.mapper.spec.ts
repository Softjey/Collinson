import { ScoringService } from '../../../scoring/scoring.service.js';
import { ScoreScale } from '../../../scoring/utils/score-scale.js';
import { ResultMapper } from '../result.mapper.js';

describe('ResultMapper', () => {
  const scoringService = {
    rate: (score: number) => new ScoreScale().rate(score),
  } as unknown as ScoringService;
  const mapper = new ResultMapper(scoringService);

  describe('toDayResult', () => {
    it('maps a score to a scored day with a rounded score and its category', () => {
      expect(mapper.toDayResult('2026-10-13', { kind: 'scored', score: 0.7349 })).toEqual({
        __typename: 'ScoredDay',
        date: '2026-10-13',
        score: 0.73,
        categoryIndex: 6,
        category: 'VERY_GOOD',
      });
    });

    it.each([0, 1])('maps the score %s at the ends of the scale', (score) => {
      expect(mapper.toDayResult('2026-10-13', { kind: 'scored', score })).toMatchObject({
        __typename: 'ScoredDay',
        score,
      });
    });

    it.each(['NO_SEA', 'NO_SNOW', 'NO_DATA'] as const)('maps %s to an unscored day', (reason) => {
      expect(mapper.toDayResult('2026-10-13', { kind: 'unscored', reason })).toEqual({
        __typename: 'UnscoredDay',
        date: '2026-10-13',
        reason,
      });
    });
  });

  describe('toFreshness', () => {
    it('keeps the time the data was fetched and whether it is stale', () => {
      const fetchedAt = new Date('2026-10-13T06:00:00Z');

      expect(mapper.toFreshness('WAVES', { status: 'ok', data: {}, fetchedAt, stale: true })).toEqual({
        kind: 'WAVES',
        updatedAt: fetchedAt,
        stale: true,
      });
    });
  });

  it('maps a too old activity', () => {
    const lastUpdatedAt = new Date('2026-10-11T06:00:00Z');

    expect(mapper.toDataTooOld('SKIING', lastUpdatedAt)).toEqual({
      __typename: 'ActivityDataTooOld',
      activity: 'SKIING',
      lastUpdatedAt,
    });
  });

  it('maps an unavailable activity', () => {
    expect(mapper.toDataUnavailable('SURFING', 'RATE_LIMITED')).toEqual({
      __typename: 'ActivityDataUnavailable',
      activity: 'SURFING',
      cause: 'RATE_LIMITED',
    });
  });

  it('maps an activity with its days and freshness', () => {
    const days = [mapper.toDayResult('2026-10-13', { kind: 'unscored', reason: 'NO_SNOW' })];
    const freshness = [
      { kind: 'WEATHER' as const, updatedAt: new Date('2026-10-13T06:00:00Z'), stale: false },
    ];

    expect(mapper.toActivityDayScores('SKIING', days, freshness)).toEqual({
      __typename: 'ActivityDayScores',
      activity: 'SKIING',
      days,
      freshness,
    });
  });

  it('maps a location', () => {
    expect(mapper.toLocation({ latitude: 41.39, longitude: 2.17, timezone: 'Europe/Madrid' }, 12)).toEqual({
      latitude: 41.39,
      longitude: 2.17,
      elevation: 12,
      timezone: 'Europe/Madrid',
    });
    expect(
      mapper.toLocation({ latitude: 41.39, longitude: 2.17, timezone: 'Europe/Madrid' }, null).elevation,
    ).toBeNull();
  });
});
