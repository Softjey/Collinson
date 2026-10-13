import type { z } from 'zod';
import { OpenMeteoUnavailableError } from '../shared/open-meteo/open-meteo.errors.js';

export function parseResponse<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new OpenMeteoUnavailableError('Open-Meteo returned an unexpected response', {
      cause: result.error,
    });
  }
  return result.data;
}

export function hasEqualLengths(hourly: Record<string, unknown[]>): boolean {
  const lengths = Object.values(hourly).map((values) => values.length);
  return lengths.every((length) => length === lengths[0]);
}

export function unixToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

export function fromE2(value: number): number {
  return value / 100;
}
