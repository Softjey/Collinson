import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { FORECAST_PARSER_VERSION } from '../forecast.client.js';
import type { ForecastData, StoredSnapshot } from '../entities/weather.types.js';

@Injectable()
export class ForecastRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async insert(
    locationId: number,
    data: ForecastData,
    fetchedAt: Date,
  ): Promise<StoredSnapshot<ForecastData>> {
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
    return { id: created.id, fetchedAt, data };
  }

  async findLatest(locationId: number): Promise<StoredSnapshot<ForecastData> | null> {
    const row = await this.prisma.forecastSnapshot.findFirst({
      where: { locationId },
      orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
      include: { hours: { orderBy: { timeUtc: 'asc' } } },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      fetchedAt: row.fetchedAt,
      data: {
        apiLatitude: row.apiLatitude,
        apiLongitude: row.apiLongitude,
        elevationM: row.elevationM,
        utcOffsetSeconds: row.utcOffsetSeconds,
        hours: row.hours.map(({ snapshotId: _snapshotId, ...hour }) => hour),
      },
    };
  }
}
