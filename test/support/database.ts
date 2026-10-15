import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set; run through the int or e2e Jest config');
  }
  return url;
}

export function createTestPrisma(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl() }) });
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "PlaceSearchHit", "PlaceSearch", "Place", "MarineHour", "MarineSnapshot", ` +
      `"ForecastHour", "ForecastSnapshot", "Location" RESTART IDENTITY CASCADE`,
  );
}

/** Registers the Jest hooks of an integration suite: one Prisma client, tables emptied before every test. */
export function useTestDatabase(): { prisma: PrismaClient } {
  const database = {} as { prisma: PrismaClient };

  beforeAll(() => {
    database.prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await truncateAll(database.prisma);
  });

  afterAll(async () => {
    await database.prisma.$disconnect();
  });

  return database;
}
