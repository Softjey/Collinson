import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { findOrCreateLocation } from '../../generated/prisma/sql.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import type { Location } from '../entities/location.js';

@Injectable()
export class LocationRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaClient) {}

  async findOrCreate(input: Omit<Location, 'id'>): Promise<Location> {
    const { latE2, lonE2, timezone } = input;
    const [row] = await this.prismaService.$queryRawTyped(findOrCreateLocation(latE2, lonE2, timezone));
    if (!row) {
      throw new Error('Location upsert returned no row');
    }
    return { id: row.id, latE2, lonE2, timezone: row.timezone ?? timezone };
  }

  async updateElevation(locationId: number, elevationM: number): Promise<void> {
    await this.prismaService.location.update({ where: { id: locationId }, data: { elevationM } });
  }

  async findElevation(locationId: number): Promise<number | null> {
    const row = await this.prismaService.location.findUniqueOrThrow({
      where: { id: locationId },
      select: { elevationM: true },
    });
    return row.elevationM;
  }
}
