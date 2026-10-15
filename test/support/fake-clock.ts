import { jest } from '@jest/globals';

export const DAY_MS = 24 * 60 * 60 * 1000;

// Only Date is faked: timers and microtasks must keep running for the HTTP server and the database driver.
const TIMING_APIS_TO_KEEP_REAL = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

export function moveClockTo(now: number): void {
  jest.useFakeTimers({ now, doNotFake: [...TIMING_APIS_TO_KEEP_REAL] });
}

export function restoreClock(): void {
  jest.useRealTimers();
}
