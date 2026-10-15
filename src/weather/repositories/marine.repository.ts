import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { MARINE_PARSER_VERSION, MarineMapper } from '../mappers/marine.mapper.js';
import type { MarineData, StoredSnapshot } from '../entities/weather.types.js';

@Injectable()
export class MarineRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly mapper: MarineMapper,
  ) {}

  async insert(locationId: number, data: MarineData, fetchedAt: Date): Promise<StoredSnapshot<MarineData>> {
    const created = await this.prisma.marineSnapshot.create({
      data: {
        locationId,
        fetchedAt,
        parserVersion: MARINE_PARSER_VERSION,
        hasSea: data.hasSea,
        apiLatitude: data.apiLatitude,
        apiLongitude: data.apiLongitude,
        hours: { createMany: { data: data.hours } },
      },
      select: { id: true },
    });
    return { id: created.id, fetchedAt, data };
  }

  async findLatest(locationId: number): Promise<StoredSnapshot<MarineData> | null> {
    const row = await this.prisma.marineSnapshot.findFirst({
      where: { locationId },
      orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
      include: { hours: { orderBy: { timeUtc: 'asc' } } },
    });
    if (!row) {
      return null;
    }
    return this.mapper.toStored(row);
  }
}
