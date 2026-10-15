import type { Place } from './place.js';

export interface StoredSearch {
  fetchedAt: Date;
  places: Place[];
}
