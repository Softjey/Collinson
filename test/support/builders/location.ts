import type { PrismaClient } from '../../../src/generated/prisma/client.js';
import type { Location } from '../../../src/location/entities/location.js';
import { BARCELONA } from './weather.js';

export async function insertLocation(
  prisma: PrismaClient,
  overrides: Partial<Omit<Location, 'id'>> = {},
): Promise<Location> {
  const { latE2, lonE2, timezone } = { ...BARCELONA, ...overrides };
  const row = await prisma.location.create({ data: { latE2, lonE2, timezone } });
  return { id: row.id, latE2, lonE2, timezone };
}
