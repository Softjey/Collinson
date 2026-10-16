import { readFileSync } from 'node:fs';

export function loadFixture<Fixture = unknown>(path: string): Fixture {
  return JSON.parse(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8')) as Fixture;
}

const SECONDS_PER_DAY = 86_400;

/** A weather response as Open-Meteo would answer `days` later: the same hours, each moved forward by whole days. */
export function shiftHourlyTimes<Response extends { hourly: { time: number[] } }>(
  response: Response,
  days: number,
): Response {
  return {
    ...response,
    hourly: {
      ...response.hourly,
      time: response.hourly.time.map((seconds) => seconds + days * SECONDS_PER_DAY),
    },
  };
}
