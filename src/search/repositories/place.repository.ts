import { Injectable } from '@nestjs/common';
import type { Place as PlaceRow } from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import type { Place } from '../entities/place.js';
import type { SearchKey } from '../utils/search-key.js';

export interface StoredSearch {
  fetchedAt: Date;
  places: Place[];
}

@Injectable()
export class PlaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSearch(key: SearchKey): Promise<StoredSearch | null> {
    const search = await this.prisma.placeSearch.findUnique({
      where: { query_language_countryCode_resultCount: toUnique(key) },
      include: { hits: { orderBy: { position: 'asc' }, include: { place: true } } },
    });
    if (!search) {
      return null;
    }
    return { fetchedAt: search.fetchedAt, places: search.hits.map((hit) => fromRow(hit.place)) };
  }

  async saveSearch(key: SearchKey, places: Place[], fetchedAt: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const place of places) {
        const data = toRow(place);
        await tx.place.upsert({ where: { id: data.id }, create: data, update: data });
      }
      const search = await tx.placeSearch.upsert({
        where: { query_language_countryCode_resultCount: toUnique(key) },
        create: { ...toUnique(key), fetchedAt },
        update: { fetchedAt },
      });
      await tx.placeSearchHit.deleteMany({ where: { searchId: search.id } });
      await tx.placeSearchHit.createMany({
        data: places.map((place, position) => ({
          searchId: search.id,
          position,
          placeId: Number(place.id),
        })),
      });
    });
  }
}

function toUnique(key: SearchKey) {
  return { query: key.query, language: key.language, countryCode: key.countryCode, resultCount: key.count };
}

function toRow(place: Place) {
  return {
    id: Number(place.id),
    name: place.name,
    country: place.country,
    countryCode: place.countryCode,
    admin1: place.admin1,
    latitude: place.latitude,
    longitude: place.longitude,
    elevationM: place.elevation,
    timezone: place.timezone,
    population: place.population,
  };
}

function fromRow(row: PlaceRow): Place {
  return {
    id: String(row.id),
    name: row.name,
    country: row.country,
    countryCode: row.countryCode,
    admin1: row.admin1,
    latitude: row.latitude,
    longitude: row.longitude,
    elevation: row.elevationM,
    timezone: row.timezone,
    population: row.population,
  };
}
