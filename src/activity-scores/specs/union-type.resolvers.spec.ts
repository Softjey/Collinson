import type { ActivityScoresResult, DayResult } from '../entities/activity-scores.result.js';
import { ActivityScoresResultResolver, DayResultResolver } from '../union-type.resolvers.js';

describe('union type resolvers', () => {
  const activityScoresResults: ActivityScoresResult[] = [
    { __typename: 'ActivityDayScores', activity: 'SKIING', days: [], freshness: [] },
    { __typename: 'ActivityDataTooOld', activity: 'SKIING', lastUpdatedAt: new Date() },
    { __typename: 'ActivityDataUnavailable', activity: 'SKIING', cause: 'RATE_LIMITED' },
  ];
  const dayResults: DayResult[] = [
    { __typename: 'ScoredDay', date: '2026-10-13', score: 0.5, categoryIndex: 4, category: 'ACCEPTABLE' },
    { __typename: 'UnscoredDay', date: '2026-10-13', reason: 'NO_DATA' },
  ];

  it.each(activityScoresResults)('resolves $__typename of ActivityScoresResult', (result) => {
    expect(new ActivityScoresResultResolver().resolveType(result)).toBe(result.__typename);
  });

  it.each(dayResults)('resolves $__typename of DayResult', (result) => {
    expect(new DayResultResolver().resolveType(result)).toBe(result.__typename);
  });
});
