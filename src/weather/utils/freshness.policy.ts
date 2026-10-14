import type { LocalDate } from '../entities/weather.types.js';

const HOUR_MS = 3_600_000;
const FETCHED_DAYS_AHEAD = 7;

export function localDateOf(instant: Date, timezone: string): LocalDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function addDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export interface ReuseInput {
  fetchedAt: Date;
  now: Date;
  refreshHours: number;
  timezone: string;
  coverThrough: LocalDate;
  requiresCoverage: boolean;
}

export function isReusable(input: ReuseInput): boolean {
  const withinInterval = input.now.getTime() - input.fetchedAt.getTime() <= input.refreshHours * HOUR_MS;
  if (!withinInterval) {
    return false;
  }
  if (!input.requiresCoverage) {
    return true;
  }
  const fetchedOn = localDateOf(input.fetchedAt, input.timezone);
  return addDays(fetchedOn, FETCHED_DAYS_AHEAD) >= input.coverThrough;
}

export interface FailureInput {
  fetchedAt: Date | null;
  now: Date;
  maxStaleHours: number;
}

export type FailureDecision = 'stale' | 'too_old' | 'unavailable';

export function decideAfterFailure(input: FailureInput): FailureDecision {
  if (input.fetchedAt === null) {
    return 'unavailable';
  }
  const age = input.now.getTime() - input.fetchedAt.getTime();
  return age <= input.maxStaleHours * HOUR_MS ? 'stale' : 'too_old';
}
