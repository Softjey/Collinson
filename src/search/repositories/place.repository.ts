import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { upsertPlaces } from '../../generated/prisma/sql.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import type { Place } from '../entities/place.js';
import type { SearchKey } from '../mappers/search-key.mapper.js';

const placeColumns = {
  id: true,
  name: true,
  country: true,
  countryCode: true,
  admin1: true,
  latitude: true,
  longitude: true,
  elevation: true,
  timezone: true,
  population: true,
} satisfies Prisma.PlaceSelect;

const placeSearchWithPlaces = {
  hits: { orderBy: { position: 'asc' }, select: { place: { select: placeColumns } } },
} satisfies Prisma.PlaceSearchInclude;

export type PlaceSearchWithPlaces = Prisma.PlaceSearchGetPayload<{ include: typeof placeSearchWithPlaces }>;

const uniqueKey = (key: SearchKey) => ({ query_language_countryCode_resultCount: key });

@Injectable()
export class PlaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSearch(key: SearchKey): Promise<PlaceSearchWithPlaces | null> {
    return this.prisma.placeSearch.findUnique({
      where: uniqueKey(key),
      include: placeSearchWithPlaces,
    });
  }

  async saveSearch(key: SearchKey, places: Place[], fetchedAt: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await storePlaces(tx, places);
      const search = await tx.placeSearch.upsert({
        where: uniqueKey(key),
        create: { ...key, fetchedAt },
        update: { fetchedAt },
      });
      await tx.placeSearchHit.deleteMany({ where: { searchId: search.id } });
      await tx.placeSearchHit.createMany({
        data: places.map((place, position) => ({ searchId: search.id, position, placeId: place.id })),
      });
    });
  }
}

async function storePlaces(tx: Prisma.TransactionClient, places: Place[]): Promise<void> {
  const rows = [...new Map(places.map((place) => [place.id, place])).values()];
  if (rows.length === 0) {
    return;
  }
  await tx.$queryRawTyped(upsertPlaces({ rows }));
}
