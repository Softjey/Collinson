# T05 `activityScores`

| | |
|---|---|
| Depends on | T02, T03 |
| Unblocks | T06 |
| Wave | 3 |

## Goal

The `activityScores` query end to end: validate the request, load the data each requested activity needs,
score every day, and map the outcome to the contract, with failures isolated per activity.

References: [technical spec](../technical-spec.md) sections 3, 5, 6;
[implementation plan](../implementation-plan.md) sections 3.5 and 2 (P4, P7, P8, P10, P11).

Touches only `src/activity-scores/` and `test/` e2e specs. It is the only module that imports both `weather`
and `scoring`.

## Scope

### 1. Time zone and date validation

- `TimeZoneService`: IANA zone from coordinates, offline (P4).
- Coordinate rounding to 2 decimals.
- `date-range.validator.ts`, using the injected `Clock` and "today" in the location's zone:
  `fromDate <= toDate`, `fromDate >= today`, `toDate <= today + 7`.
- Input DTO with class-validator: latitude -90 to 90, longitude -180 to 180, `activities` non-empty and
  de-duplicated.
- Every violation is a `BAD_USER_INPUT` error raised before any data access.

### 2. Orchestration (plan section 3.5)

- `location.findOrCreate` with the rounded coordinates and the zone.
- The union of the requested activities' required sources (`ScoringService.requiredSources`) decides what is loaded; forecast and marine load in
  parallel, once per request, with `coverThrough = toDate`.
- Daily features are derived once from the loaded data and shared by all activities.
- Per activity, combine its source results (P7): any unavailable gives `ActivityDataUnavailable`; else any
  too old gives `ActivityDataTooOld` with the oldest `fetchedAt`; else score every date of the range.
- A date the data in use does not cover is evaluated with missing features, which gives `NO_DATA`.

### 3. Mapping

- `result.mapper.ts`: `ScoredDay` (rounded score, `categoryIndex`, `category`), `UnscoredDay`,
  `ActivityDayScores` with `freshness` for exactly the sources the activity requires, `ActivityDataTooOld`,
  `ActivityDataUnavailable`.
- `location`: rounded coordinates, the offline zone, `elevation` from `Location.elevationM` (null until the
  first forecast snapshot exists).
- `__resolveType` for `ActivityScoresResult` and `DayResult`.
- Resolver replacing the T01 stub.

## Tests first

Unit, validation (fake clock):

- `from > to` rejected; `from` before today rejected; `to` at today + 8 rejected; today to today + 7 accepted;
  a single-day range accepted.
- "Today" differs by zone at the same instant (Auckland versus Honolulu), so the same dates are valid for one
  and invalid for the other.
- Rounding: 41.3851 to 41.39, -0.1278 to -0.13, -0.001 to 0 (no negative zero), 89.999 to 90.
- Latitude 90 and -90 accepted, 90.01 rejected; longitude 180 and -180 accepted, 180.01 rejected.
- Empty `activities` rejected; duplicates collapse to one result.

Unit, combination and mapping:

- One source: ok, too old, unavailable.
- Two sources (surfing): both ok; waves unavailable and weather ok; weather too old and waves ok; one too old
  and the other unavailable gives unavailable; both too old gives the older `lastUpdatedAt`; a 429 on either
  gives `RATE_LIMITED`.
- Freshness: skiing has `WEATHER` only; surfing has `WEATHER` and `WAVES`, each with its own `updatedAt` and
  `stale`.
- Days are in date order, one per date of the range.
- Union type resolution for every variant.

e2e (scripted Open-Meteo, fake clock, Testcontainers):

- Coastal point, all four activities, 8 days: every day is a `ScoredDay` or a valid `UnscoredDay`, scores are
  in 0 to 1 and categories match.
- Inland point: every surfing day is `NO_SEA`; a second request does not call the marine API.
- A second request within the interval makes no upstream call.
- Requesting only `SKIING` does not call the marine API.
- Marine down, nothing stored: only surfing is `ActivityDataUnavailable`.
- Forecast down, nothing stored: all four are unavailable and `location.elevation` is null.
- Forecast returns 429, nothing stored: cause is `RATE_LIMITED`.
- Forecast down, snapshot 10 hours old: scores returned, `stale: true`, `updatedAt` is the original fetch time.
- Forecast down, snapshot 50 hours old: `ActivityDataTooOld` with that time.
- Forecast down, snapshot from yesterday, range to today + 7: the last day is `NO_DATA`, the others scored.
- Fresh snapshot fetched before local midnight, range to today + 7: a refetch happens and every day is scored.
- Default `activities` returns all four in the contract order.
- Each validation failure returns `BAD_USER_INPUT` and makes no upstream call.

## Done when

- Every e2e scenario above passes.
- A failure of one source never turns the whole query into a GraphQL error.

## Out of scope

Changes to formulas, ranking or sorting (the client sorts), authentication and rate limiting.
