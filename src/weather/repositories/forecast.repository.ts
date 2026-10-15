import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { PARSER_VERSIONS } from '../utils/parser-versions.js';
import type { ForecastData } from '../entities/weather.types.js';

export type ForecastSnapshotRow = Prisma.ForecastSnapshotGetPayload<{ include: { hours: true } }>;

@Injectable()
export class ForecastRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaClient) {}

  async insert(locationId: number, data: ForecastData, fetchedAt: Date): Promise<{ id: number }> {
    const { hours, ...snapshot } = data;
    const [created] = await this.prismaService.$transaction([
      this.prismaService.forecastSnapshot.create({
        data: {
          locationId,
          fetchedAt,
          parserVersion: PARSER_VERSIONS.forecast,
          apiLatitude: snapshot.apiLatitude,
          apiLongitude: snapshot.apiLongitude,
          elevationM: snapshot.elevationM,
          utcOffsetSeconds: snapshot.utcOffsetSeconds,
          hours: { createMany: { data: hours } },
        },
        select: { id: true },
      }),
      ...(snapshot.elevationM === null
        ? []
        : [
            this.prismaService.location.update({
              where: { id: locationId },
              data: { elevationM: snapshot.elevationM },
              select: { id: true },
            }),
          ]),
    ]);
    return { id: created.id };
  }

  async findLatest(locationId: number): Promise<ForecastSnapshotRow | null> {
    return this.prismaService.forecastSnapshot.findFirst({
      where: { locationId },
      orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
      include: { hours: { orderBy: { timeUtc: 'asc' } } },
    });
  }
}
