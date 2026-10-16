import { BadRequestException } from '@nestjs/common';
import type { Clock } from '../../shared/clock.js';
import { DateRangeValidator } from '../date-range.validator.js';
import type { ActivityScoresInput } from '../entities/activity-scores.input.js';
import { TimeZoneService } from '../time-zone.service.js';

const NOW = '2026-10-13T12:00:00Z';
const clockAt = (instant: string): Clock => ({ now: () => new Date(instant) });

const MADRID = { latitude: 40.42, longitude: -3.7 };
const AUCKLAND = { latitude: -36.85, longitude: 174.76 };
const HONOLULU = { latitude: 21.31, longitude: -157.86 };

describe('DateRangeValidator', () => {
  const validatorAt = (instant: string) => new DateRangeValidator(clockAt(instant), new TimeZoneService());
  const validator = validatorAt(NOW);
  const inputFor = (fromDate: string, toDate: string, point = MADRID) =>
    ({ ...point, fromDate, toDate, activities: ['SKIING'] }) as ActivityScoresInput;
  const validate = (fromDate: string, toDate: string, point = MADRID) =>
    validator.transform(inputFor(fromDate, toDate, point));

  it('returns the input unchanged when the range is valid', () => {
    const input = inputFor('2026-10-13', '2026-10-20');

    expect(validator.transform(input)).toBe(input);
  });

  it('accepts a single day', () => {
    expect(() => validate('2026-10-15', '2026-10-15')).not.toThrow();
    expect(() => validate('2026-10-20', '2026-10-20')).not.toThrow();
  });

  it('rejects fromDate after toDate', () => {
    expect(() => validate('2026-10-15', '2026-10-14')).toThrow(BadRequestException);
    expect(() => validate('2026-10-15', '2026-10-14')).toThrow(/fromDate/);
  });

  it('rejects fromDate before today', () => {
    expect(() => validate('2026-10-12', '2026-10-14')).toThrow(BadRequestException);
    expect(() => validate('2026-10-12', '2026-10-14')).toThrow(/today/);
  });

  it('rejects toDate at today + 8', () => {
    expect(() => validate('2026-10-13', '2026-10-21')).toThrow(BadRequestException);
    expect(() => validate('2026-10-13', '2026-10-21')).toThrow(/toDate/);
  });

  it('takes "today" in the time zone of the location', () => {
    expect(() => validate('2026-10-13', '2026-10-14', HONOLULU)).not.toThrow();
    expect(() => validate('2026-10-13', '2026-10-14', AUCKLAND)).toThrow(BadRequestException);
    expect(() => validate('2026-10-14', '2026-10-21', AUCKLAND)).not.toThrow();
    expect(() => validate('2026-10-13', '2026-10-21', HONOLULU)).toThrow(BadRequestException);
  });
});
