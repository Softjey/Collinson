import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { upsertPlaces } from '../../generated/prisma/sql.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import type { Place } from '../entities/place.js';
import {
  PlaceSearchMapper,
  placeSearchWithPlaces,
  type StoredSearch,
} from '../mappers/place-search.mapper.js';
import type { SearchKey } from '../mappers/search-key.mapper.js';

const uniqueKey = (key: SearchKey) => ({ query_language_countryCode_resultCount: key });

@Injectable()
export class PlaceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: PlaceSearchMapper,
  ) {}

  async findSearch(key: SearchKey): Promise<StoredSearch | null> {
    const search = await this.prisma.placeSearch.findUnique({
      where: uniqueKey(key),
      include: placeSearchWithPlaces,
    });
    return search && this.mapper.toStoredSearch(search);
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
