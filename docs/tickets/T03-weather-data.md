# T03 Weather data

| | |
|---|---|
| Depends on | T01 |
| Unblocks | T05 |
| Wave | 2, parallel with T02 and T04 |

## Goal

The `weather` module: given a location and the last date that must be covered, return forecast and marine data
from storage or from Open-Meteo, following the refresh, staleness and concurrency rules. The rest of the
service never sees Prisma types or Open-Meteo responses.

References: [technical spec](../technical-spec.md) sections 4, 5, 6;
[implementation plan](../implementation-plan.md) sections 3.3, 3.4 and 2 (P6, P14).

Touches only `src/weather/` and `test/fixtures/weather/`. No import from `search` or `scoring`.

## Scope

### 1. Forecast and marine clients

- Built on `OpenMeteoService` from T01.
- Forecast request: the 10 hourly variables of spec section 4, `forecast_days=8`, the time zone passed in,
  `timeformat=unixtime`.
- Marine request: the 5 hourly variables, `forecast_days=8`, the same time zone, `timeformat=unixtime`,
  `cell_selection=sea`.
- zod schemas for both responses; mappers to domain rows with UTC instants and nulls preserved.
- Marine with every `wave_height` null maps to `hasSea = false` and no hours.
- `FORECAST_PARSER_VERSION` and `MARINE_PARSER_VERSION`, starting at 1, with a comment on when to bump them.
- A response that fails zod validation is an unavailable failure.

### 2. Persistence

- `LocationRepository`: find or create by `(latE2, lonE2)` with the time zone; update `elevationM`.
- `ForecastSnapshotRepository` and `MarineSnapshotRepository`: insert a snapshot with its hours in one
  transaction (`createMany`); read the newest by `fetchedAt DESC, id DESC`.
- A successful forecast insert also updates `Location.elevationM`.
- Repositories return domain types.

### 3. Refresh service

- `freshness.policy.ts`: the pure decision of plan section 3.4 (reuse, fetch, stale, too old, unavailable).
- `single-flight.ts` usage: one in-flight fetch per `"<source>:<locationId>"`; a failed flight is not kept.
- `WeatherService` with `resolveLocation`, `getForecast`, `getMarine` returning `SourceResult` (plan 3.3).
- Intervals and the stale limit come from configuration.

## Tests first

Unit, clients (recorded response fixtures, fake HTTP client):

- Request parameters are exactly as specified for forecast and for marine.
- 192 hours map to rows with the right UTC instants; nulls stay null.
- Marine all-null maps to `hasSea = false` with no hours; marine with data maps to `hasSea = true`.
- Malformed responses are rejected: missing `hourly`, arrays of different lengths, wrong value types.
- HTTP client errors pass through with their type.

Unit, policy and service (fake clock, fake clients and repositories):

- Within the interval and covering gives reuse with no upstream call.
- Older than the interval gives a fetch; the new snapshot is stored and returned with `stale = false`.
- Within the interval but not covering `coverThrough` gives a fetch.
- Inland marine (`hasSea = false`) within 24 hours is reused whatever `coverThrough` is.
- Fetch fails with a snapshot 47 hours old gives `ok` with `stale = true` and the original `fetchedAt`.
- Fetch fails with a snapshot 49 hours old gives `too_old` with its `fetchedAt`.
- Fetch fails with no snapshot gives `unavailable`: `RATE_LIMITED` for a 429, otherwise
  `TEMPORARILY_UNAVAILABLE`.
- Forecast uses the 6 hour interval and marine the 24 hour one.
- Single-flight: two concurrent calls for the same location and source make one upstream call and one insert;
  forecast and marine do not share a flight; two locations do not share; after a failed flight the next call
  tries again.

Integration (Testcontainers):

- Find-or-create is idempotent and safe under two concurrent calls.
- A forecast snapshot writes 192 hours atomically and updates `Location.elevationM`.
- The newest snapshot wins by `fetchedAt`, then by `id`.
- An inland marine snapshot is stored without hours and read back with `hasSea = false`.
- A location without snapshots reads as nothing.

## Done when

- `WeatherService` is exported from the module and is the only thing other modules use.
- All tests above pass; no test calls the real Open-Meteo.

## Out of scope

Date validation and time zone lookup (T05 passes the zone and `coverThrough` in), daily features, scoring,
snapshot clean-up, cross-instance locking.
