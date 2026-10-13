import { decideAfterFailure, isReusable, localDateOf } from './freshness.policy.js';

const HOUR = 3_600_000;
const now = new Date('2026-10-13T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * HOUR);

const base = {
  now,
  refreshHours: 6,
  timezone: 'Europe/Madrid',
  coverThrough: '2026-10-20',
  requiresCoverage: true,
};

describe('localDateOf', () => {
  it('uses the calendar date in the given time zone', () => {
    const instant = new Date('2026-10-13T22:30:00Z');

    expect(localDateOf(instant, 'UTC')).toBe('2026-10-13');
    expect(localDateOf(instant, 'Europe/Madrid')).toBe('2026-10-14');
    expect(localDateOf(instant, 'America/Los_Angeles')).toBe('2026-10-13');
  });
});

describe('isReusable', () => {
  it('reuses a snapshot within the interval that covers the date', () => {
    expect(isReusable({ ...base, fetchedAt: hoursAgo(2) })).toBe(true);
  });

  it('reuses a snapshot exactly at the interval', () => {
    expect(isReusable({ ...base, fetchedAt: hoursAgo(6) })).toBe(true);
  });

  it('does not reuse a snapshot older than the interval', () => {
    expect(isReusable({ ...base, fetchedAt: new Date(now.getTime() - 6 * HOUR - 1) })).toBe(false);
  });

  it('does not reuse a snapshot that does not cover coverThrough', () => {
    const fetchedAt = new Date('2026-10-12T23:00:00Z');

    expect(localDateOf(fetchedAt, base.timezone)).toBe('2026-10-13');
    expect(isReusable({ ...base, fetchedAt, now: new Date('2026-10-13T01:00:00Z'), coverThrough: '2026-10-21' })).toBe(
      false,
    );
  });

  it('covers today plus 7 days of the local fetch date', () => {
    const fetchedAt = hoursAgo(1);

    expect(isReusable({ ...base, fetchedAt, coverThrough: '2026-10-20' })).toBe(true);
    expect(isReusable({ ...base, fetchedAt, coverThrough: '2026-10-21' })).toBe(false);
  });

  it('computes the fetch date in the location time zone', () => {
    const fetchedAt = new Date('2026-10-13T22:30:00Z');
    const input = { ...base, fetchedAt, now: new Date('2026-10-13T23:00:00Z') };

    expect(isReusable({ ...input, coverThrough: '2026-10-21' })).toBe(true);
    expect(isReusable({ ...input, timezone: 'UTC', coverThrough: '2026-10-21' })).toBe(false);
  });

  it('ignores coverage when the snapshot does not need it', () => {
    const fetchedAt = hoursAgo(10);

    expect(
      isReusable({ ...base, fetchedAt, refreshHours: 24, requiresCoverage: false, coverThrough: '2030-01-01' }),
    ).toBe(true);
  });

  it('still applies the interval when coverage is ignored', () => {
    expect(isReusable({ ...base, fetchedAt: hoursAgo(25), refreshHours: 24, requiresCoverage: false })).toBe(false);
  });
});

describe('decideAfterFailure', () => {
  const maxStaleHours = 48;

  it('serves a snapshot within the stale limit as stale', () => {
    expect(decideAfterFailure({ fetchedAt: hoursAgo(47), now, maxStaleHours })).toBe('stale');
  });

  it('serves a snapshot exactly at the stale limit', () => {
    expect(decideAfterFailure({ fetchedAt: hoursAgo(48), now, maxStaleHours })).toBe('stale');
  });

  it('reports a snapshot beyond the stale limit as too old', () => {
    expect(decideAfterFailure({ fetchedAt: hoursAgo(49), now, maxStaleHours })).toBe('too_old');
  });

  it('reports unavailable when there is no snapshot', () => {
    expect(decideAfterFailure({ fetchedAt: null, now, maxStaleHours })).toBe('unavailable');
  });
});
