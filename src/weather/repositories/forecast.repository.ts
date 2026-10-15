import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { FORECAST_PARSER_VERSION } from '../entities/parser-versions.js';
import type { ForecastData } from '../entities/weather.types.js';

export type ForecastSnapshotRow = Prisma.ForecastSnapshotGetPayload<{ include: { hours: true } }>;

@Injectable()
export class ForecastRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async insert(locationId: number, data: ForecastData, fetchedAt: Date): Promise<{ id: number }> {
    const { hours, ...snapshot } = data;
    const [created] = await this.prisma.$transaction([
      this.prisma.forecastSnapshot.create({
        data: {
          locationId,
          fetchedAt,
          parserVersion: FORECAST_PARSER_VERSION,
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
            this.prisma.location.update({
              where: { id: locationId },
              data: { elevationM: snapshot.elevationM },
              select: { id: true },
            }),
          ]),
    ]);
    return { id: created.id };
  }

  async findLatest(locationId: number): Promise<ForecastSnapshotRow | null> {
    return this.prisma.forecastSnapshot.findFirst({
      where: { locationId },
      orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
      include: { hours: { orderBy: { timeUtc: 'asc' } } },
    });
  }
}
