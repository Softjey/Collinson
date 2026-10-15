import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import type { LocationRef } from '../entities/weather.types.js';

@Injectable()
export class LocationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async findOrCreate(input: Omit<LocationRef, 'id'>): Promise<LocationRef> {
    const { latE2, lonE2, timezone } = input;
    const [row] = await this.prisma.$queryRaw<{ id: number; timezone: string }[]>`
      INSERT INTO "Location" ("latE2", "lonE2", "timezone", "updatedAt")
      VALUES (${latE2}, ${lonE2}, ${timezone}, now())
      ON CONFLICT ("latE2", "lonE2") DO UPDATE SET "timezone" = COALESCE("Location"."timezone", EXCLUDED."timezone")
      RETURNING "id", "timezone"`;
    if (!row) {
      throw new Error('Location upsert returned no row');
    }
    return { id: row.id, latE2, lonE2, timezone: row.timezone };
  }

  async updateElevation(locationId: number, elevationM: number): Promise<void> {
    await this.prisma.location.update({ where: { id: locationId }, data: { elevationM } });
  }
}
