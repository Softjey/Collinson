import type { Place } from './place.js';

export interface StoredPlaceSearch {
  fetchedAt: Date;
  places: Place[];
}
