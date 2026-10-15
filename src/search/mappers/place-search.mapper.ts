import { Injectable } from '@nestjs/common';
import type { StoredPlaceSearch } from '../entities/stored-place-search.js';
import type { PlaceSearchWithPlaces } from '../repositories/place.repository.js';

@Injectable()
export class PlaceSearchMapper {
  toStoredSearch({ fetchedAt, hits }: PlaceSearchWithPlaces): StoredPlaceSearch {
    return { fetchedAt, places: hits.map((hit) => hit.place) };
  }
}
