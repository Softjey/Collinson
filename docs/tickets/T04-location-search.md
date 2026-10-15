# T04 Location search

| | |
|---|---|
| Depends on | T01 |
| Unblocks | T06 |
| Wave | 2, parallel with T02 and T03 |

## Goal

The `searchLocations` query: find places by name through the Open-Meteo geocoder and keep the results for 30
days so repeated searches do not call it.

References: [technical spec](../technical-spec.md) sections 3, 4, 5;
[implementation plan](../implementation-plan.md) section 2 (P11, P12, P13).

Touches only `src/search/` and `test/fixtures/search/`. No import from `weather` or `scoring`.

## Scope

- `OpenMeteoService.geocoding` (T01) validates the response with zod and returns camelCased places with nulls for
  missing fields; a response without `results` is an empty list. `GeocodingClient` only builds the request
  (`name`, `count`, `language`, optional `countryCode`) and returns the places.
- `PlaceRepository`: upsert `Place` by GeoNames id; find a `PlaceSearch` by its key; store a search with its
  ordered hits; replace the hits of an existing search in one transaction.
- `PlaceSearchService`:
  - cache key `(lower(trim(name)), language, countryCode or "", count)`;
  - a stored search younger than `PLACE_SEARCH_CACHE_DAYS` is returned without calling the geocoder;
  - otherwise the geocoder is called and the search stored or refreshed;
  - if the geocoder fails and a stored search exists (of any age), it is returned;
  - if the geocoder fails and nothing is stored, a GraphQL error with `extensions.code = SERVICE_UNAVAILABLE`.
- Resolver replacing the T01 stub, with an args class validated by class-validator: `name` trimmed and 1 to
  100 characters, `count` 1 to 100, `countryCode` 2 letters (upper-cased), `language` 2 letters.
- `Place.id` is the GeoNames id as a number everywhere; GraphQL serialises it as `ID`. `Place.elevation` has the
  same name in the geocoder, the domain, the database and the contract.
- The upsert of the places of a search is one TypedSQL statement (`prisma/sql/upsertPlaces.sql`).
- `mappers/` holds `PlaceSearchKeyMapper` (the cache key) and `PlaceSearchMapper` (database row to stored search)
  . Validation decorators (`@Trim`, `@IsCountryCode`, `@IsLanguageCode`, `@NullToUndefined`)
  come from `shared/validation`.

## Tests first

Unit:

- Geocoder mapping of a full result and of a result with only the required fields.
- A response without `results` gives an empty list.
- Malformed results are rejected by zod (tested in the `OpenMeteoService` spec).
- Cache key normalisation: `"  Zakopane "` and `"zakopane"` are the same key; a different language, country
  or count is a different key.

Integration (Testcontainers):

- Places are upserted by id, and a changed name updates the row.
- Hits come back in their stored order.
- Refreshing a search replaces its hits and updates `fetchedAt`.
- The same place can be a hit of two searches.

e2e (scripted Open-Meteo):

- The first search calls the geocoder once and returns the places in order.
- The same search again makes no call.
- A search differing only in case or surrounding spaces makes no call.
- An empty result is returned as `[]` and is cached.
- With the clock moved 31 days forward, the search calls the geocoder again.
- Geocoder down with a stored result returns the stored result.
- Geocoder down with nothing stored returns `SERVICE_UNAVAILABLE`.
- `count` 0, `count` 101, an empty `name` and a 3-letter `countryCode` return `BAD_USER_INPUT` and make no call.
- Defaults: `count` 10 and `language` `en` are sent when omitted.

## Done when

- `searchLocations` works end to end against the scripted geocoder.
- `src/search` has no import from `src/weather`, `src/scoring` or `src/activity-scores`.

## Out of scope

Linking places to weather locations (there is no such link by design), fuzzy matching of our own.
