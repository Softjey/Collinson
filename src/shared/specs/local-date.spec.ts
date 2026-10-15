import { addDays, datesBetween, localDateOf } from '../local-date.js';

describe('localDateOf', () => {
  it('uses the calendar date in the given time zone', () => {
    const instant = new Date('2026-10-13T22:30:00Z');

    expect(localDateOf(instant, 'UTC')).toBe('2026-10-13');
    expect(localDateOf(instant, 'Europe/Madrid')).toBe('2026-10-14');
    expect(localDateOf(instant, 'America/Los_Angeles')).toBe('2026-10-13');
  });
});

describe('addDays', () => {
  it('moves across a month and a year boundary', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('moves backwards', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('datesBetween', () => {
  it('lists every date from the first to the last, inclusive', () => {
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('lists one date for a single-day range', () => {
    expect(datesBetween('2026-10-13', '2026-10-13')).toEqual(['2026-10-13']);
  });

  it('lists nothing when the range is reversed', () => {
    expect(datesBetween('2026-10-14', '2026-10-13')).toEqual([]);
  });
});
