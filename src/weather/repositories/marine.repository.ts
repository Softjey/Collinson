import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { PARSER_VERSIONS } from '../utils/parser-versions.js';
import type { MarineData } from '../entities/weather.types.js';

export type MarineSnapshotRow = Prisma.MarineSnapshotGetPayload<{ include: { hours: true } }>;

@Injectable()
export class MarineRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaClient) {}

  async insert(locationId: number, data: MarineData, fetchedAt: Date): Promise<{ id: number }> {
    const created = await this.prismaService.marineSnapshot.create({
      data: {
        locationId,
        fetchedAt,
        parserVersion: PARSER_VERSIONS.marine,
        hasSea: data.hasSea,
        apiLatitude: data.apiLatitude,
        apiLongitude: data.apiLongitude,
        hours: { createMany: { data: data.hours } },
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  async findLatest(locationId: number): Promise<MarineSnapshotRow | null> {
    return this.prismaService.marineSnapshot.findFirst({
      where: { locationId },
      orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
      include: { hours: { orderBy: { timeUtc: 'asc' } } },
    });
  }
}
