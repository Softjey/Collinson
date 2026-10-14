import { z } from 'zod';

export const hourlyValues = z.array(z.number().nullable());

export const hasEqualLengths = (hourly: Record<string, unknown[]>): boolean => {
  const lengths = Object.values(hourly).map((values) => values.length);
  return lengths.every((length) => length === lengths[0]);
};
