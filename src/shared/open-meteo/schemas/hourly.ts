import { z } from 'zod';

export const hourlyValues = z.array(z.number().nullable());

export const hasEqualLengths = (hourly: object): boolean => {
  const lengths = Object.values(hourly as Record<string, unknown[]>).map((values) => values.length);
  return lengths.every((length) => length === lengths[0]);
};

type HourlyShape<Variable extends string> = { time: z.ZodArray<z.ZodNumber> } & Record<
  Variable,
  typeof hourlyValues
>;

// The same list drives the `hourly` request parameter and the response schema, so the two cannot drift apart.
export function hourlySchema<Variable extends string>(variables: readonly Variable[], minHours = 0) {
  const variableShape = Object.fromEntries(variables.map((variable) => [variable, hourlyValues]));
  const shape = { time: z.array(z.number().int()).min(minHours), ...variableShape } as HourlyShape<Variable>;
  return z.object(shape).refine(hasEqualLengths, { message: 'hourly arrays must have the same length' });
}
