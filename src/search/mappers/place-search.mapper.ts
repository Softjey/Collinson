import type { Prisma } from '../../generated/prisma/client.js';
import type { Place } from '../entities/place.js';

export const placeColumns = {
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

export const placeSearchWithPlaces = {
  hits: { orderBy: { position: 'asc' }, select: { place: { select: placeColumns } } },
} satisfies Prisma.PlaceSearchInclude;

export type PlaceSearchWithPlaces = Prisma.PlaceSearchGetPayload<{ include: typeof placeSearchWithPlaces }>;

export interface StoredSearch {
  fetchedAt: Date;
  places: Place[];
}

export const toStoredSearch = ({ fetchedAt, hits }: PlaceSearchWithPlaces): StoredSearch => ({
  fetchedAt,
  places: hits.map((hit) => hit.place),
});
