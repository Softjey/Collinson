import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client.js';
import { PrismaService } from '../shared/database/prisma.service.js';
import type { LocationRef } from './weather.types.js';

@Injectable()
export class LocationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async findOrCreate(input: Omit<LocationRef, 'id'>): Promise<LocationRef> {
    const { latE2, lonE2, timezone } = input;
    const row = await this.prisma.location.upsert({
      where: { latE2_lonE2: { latE2, lonE2 } },
      create: { latE2, lonE2, timezone },
      update: {},
    });
    if (row.timezone === null) {
      await this.prisma.location.update({ where: { id: row.id }, data: { timezone } });
    }
    return { id: row.id, latE2, lonE2, timezone: row.timezone ?? timezone };
  }

  async updateElevation(locationId: number, elevationM: number): Promise<void> {
    await this.prisma.location.update({ where: { id: locationId }, data: { elevationM } });
  }
}
