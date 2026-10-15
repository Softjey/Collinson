import { Injectable } from '@nestjs/common';
import type { StoredSearch } from '../entities/stored-search.js';
import type { PlaceSearchWithPlaces } from '../repositories/place.repository.js';

@Injectable()
export class PlaceSearchMapper {
  toStoredSearch({ fetchedAt, hits }: PlaceSearchWithPlaces): StoredSearch {
    return { fetchedAt, places: hits.map((hit) => hit.place) };
  }
}
