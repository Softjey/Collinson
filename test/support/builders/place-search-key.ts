import { PlaceSearchKeyMapper } from '../../../src/search/mappers/place-search-key.mapper.js';

const mapper = new PlaceSearchKeyMapper();

export const toPlaceSearchKey = mapper.toKey.bind(mapper);
