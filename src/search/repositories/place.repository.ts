import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
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
      await upsertPlaces(tx, places);
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

async function upsertPlaces(tx: Prisma.TransactionClient, places: Place[]): Promise<void> {
  const rows = [...new Map(places.map((place) => [place.id, toRow(place)])).values()];
  if (rows.length === 0) {
    return;
  }
  const values = Prisma.join(
    rows.map(
      (r) =>
        Prisma.sql`(${r.id}, ${r.name}, ${r.country}, ${r.countryCode}, ${r.admin1}, ${r.latitude}, ${r.longitude}, ${r.elevationM}, ${r.timezone}, ${r.population}, now())`,
    ),
  );
  await tx.$executeRaw`
    INSERT INTO "Place" ("id", "name", "country", "countryCode", "admin1", "latitude", "longitude", "elevationM", "timezone", "population", "updatedAt")
    VALUES ${values}
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "country" = EXCLUDED."country",
      "countryCode" = EXCLUDED."countryCode",
      "admin1" = EXCLUDED."admin1",
      "latitude" = EXCLUDED."latitude",
      "longitude" = EXCLUDED."longitude",
      "elevationM" = EXCLUDED."elevationM",
      "timezone" = EXCLUDED."timezone",
      "population" = EXCLUDED."population",
      "updatedAt" = now()`;
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
