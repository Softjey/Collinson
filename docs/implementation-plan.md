# Implementation plan

Architecture and ticket breakdown for the whole backend. It builds on
[technical-spec.md](technical-spec.md) and [DECISIONS.md](../DECISIONS.md) and does not repeat them: formulas,
tables and measurements stay in the spec.

Status words are the same as in the spec: **Decided** (confirmed by the owner), **Proposal** (to be confirmed,
listed in section 2), **Verify** (check against a primary source inside the ticket).

## 1. Decisions taken while planning (decided)

| Topic | Decision |
|---|---|
| Snapshot does not cover the requested dates | A stored snapshot is used only if it is within its refresh interval **and** covers the requested range. Otherwise it is refetched. After local midnight a snapshot fetched the day before no longer contains today+7. |
| Day without data | `UnscoredReason` gets a third value, `NO_DATA`, for a day that the snapshot in use has no usable hours for. The other days of the activity are returned normally. |
| `ScoredLocation.elevation` | Nullable (`Float`). It is null only until the first weather snapshot for the point exists. `latitude`, `longitude` and `timezone` are always present. |
| GraphQL approach | Schema-first. The contract lives in its own folder as the fixed contract used for communication; the file in `docs/` was a draft. |
| e2e database | Testcontainers. |
| Place search cache lifetime | 30 days. |

Facts verified against the live API on 2026-10-13:

- `timeformat=unixtime` works on both Forecast and Marine; `hourly.time` is an array of unix seconds and the
  first element is 00:00 local time of the current day in the requested `timezone`.
- Forecast with the 10 variables and `forecast_days=8` returns 192 hours; Marine with `cell_selection=sea`
  returns 192 hours for Barcelona and HTTP 200 with all values null for Madrid.
- Geocoding returns HTTP 200 without a `results` key when nothing matches. A result has `id`, `name`,
  `latitude`, `longitude`, and optional `elevation`, `country`, `country_code`, `admin1`, `timezone`,
  `population`.
- npm: `@nestjs/core` 12.1.3, `@nestjs/graphql` 14.0.3, `@nestjs/apollo` 14.0.3, `@apollo/server` 5.5.1,
  `graphql` 17.0.2, `@prisma/client` 7.10.0 (`prisma` dist-tag `prev` is 7.10.0, `latest` is 8.0.0-rc.22),
  `@prisma/adapter-pg` 7.10.0, `zod` 4.6.7, `class-validator` 0.15.1, `@testcontainers/postgresql` 12.2.1,
  `@photostructure/tz-lookup` 11.7.0, `jest` 30.5.2, `typescript` 7.0.2.

## 2. Proposals to confirm

These are not recorded in DECISIONS.md until confirmed. The tickets below assume them.

| # | Topic | Proposal |
|---|---|---|
| P1 | GraphQL driver | Apollo Server 5 on Express (`@nestjs/apollo`). |
| P2 | Contract location | `contracts/graphql/schema.graphql`, loaded by the service as `typePaths`. One file, so the contract and the implementation cannot diverge. `docs/graphql-schema.graphql` is moved there. |
| P3 | Package manager, test runner | pnpm, Jest (unit and e2e). |
| P4 | Offline time zone library | `@photostructure/tz-lookup` (small, no native code). Its border accuracy is enough because the same zone is passed to Open-Meteo, so validation and day grouping always agree. |
| P5 | Environment variables | See section 3.6. |
| P6 | Retry policy | One retry on network error, timeout and HTTP 5xx. No retry on 429 or other 4xx. |
| P7 | Activity result when sources disagree | Any required source unavailable gives `ActivityDataUnavailable` (`RATE_LIMITED` if any failure was a 429, otherwise `TEMPORARILY_UNAVAILABLE`). Else any source too old gives `ActivityDataTooOld` with `lastUpdatedAt` of the oldest such source. Else `ActivityDayScores`. |
| P8 | Order of day checks | Surfing: `NO_SEA` if `hasSea = false`, else `NO_DATA` if a needed feature is missing, else scored. Skiing: `NO_DATA` if a needed feature is missing, else `NO_SNOW`, else scored. A feature is missing only when every hourly value of the day is null. |
| P9 | Score rounding | The score is rounded to 2 decimals, and the category is taken from the rounded value, so the bands of spec 8.6 apply literally. |
| P10 | `ScoredLocation` coordinates | The rounded request coordinates (always available), not the Open-Meteo grid point. |
| P11 | Input rules not in the spec | `activities` must be non-empty and is de-duplicated. `searchLocations.name` is trimmed, 1 to 100 characters. `countryCode` is 2 letters, upper-cased. |
| P12 | Error shape | Validation failures are GraphQL errors with `extensions.code = BAD_USER_INPUT`. A failed place search with nothing stored is a GraphQL error with `extensions.code = SERVICE_UNAVAILABLE` (the contract has no error type for it). |
| P13 | Place search cache key | `(lower(trim(name)), language, countryCode or "", count)`. After 30 days the search is refetched and its hits replaced. If the geocoder fails, the stored result is returned. |
| P14 | `parserVersion` | A constant per source, starting at 1, bumped whenever the mapping from the upstream response to columns changes. Documented next to the constant. |
| P15 | Paid plan key | `OPEN_METEO_API_KEY`, sent as the `apikey` query parameter, with the customer base URLs set through the URL variables (Verify in T01). |

## 3. Architecture

### 3.1 Modules and dependencies

```
                     +------------------+        +------------------+
 GraphQL (Apollo) -> | activity-scores  |        |      search      | <- GraphQL
                     +---+----------+---+        +---------+--------+
                         |          |                      |
                 +-------v--+   +---v------+               |
                 | weather  |   | scoring  |               |
                 +----+-----+   +----------+               |
                      |          (pure)                    |
        +-------------v-----------------------------------v-----------+
        | shared: config, database (Prisma), open-meteo http, clock   |
        +-------------------------------------------------------------+
```

Rules:

- `search` and `weather` never import each other and share no foreign keys. Each owns its tables.
- `scoring` has no NestJS providers that touch I/O, no Prisma types and no imports from `weather`. It defines the
  input shapes it needs.
- `activity-scores` is the only module that knows both `weather` and `scoring`.
- A module exports only its service, and only when another module needs it. Currently that is `WeatherService` and
  `ScoringService`; `search` exports nothing. Public methods take and return plain types owned by the module.
- Validation of an upstream response belongs to `shared/open-meteo`: `OpenMeteoService` returns validated,
  already camelCased data, and `weather` and `search` never see raw Open-Meteo shapes.
- `shared` holds only technical code with no domain knowledge. Splitting a module into its own service means
  copying `shared`.

### 3.2 Directory layout

```
contracts/graphql/schema.graphql
prisma/schema.prisma, prisma/migrations/, prisma/sql/ (TypedSQL queries)
prisma.config.ts, scripts/generate-prisma.mjs
src/
  main.ts, app.module.ts
  shared/
    config/        env.schema.ts, config.module.ts
    database/      prisma.service.ts, database.module.ts
    open-meteo/    open-meteo.module.ts, open-meteo.service.ts, open-meteo-http.client.ts (internal),
                   open-meteo.errors.ts, schemas/ (zod schemas of the three responses, camelCased output)
    validation/    @Trim, @IsCountryCode, @IsLanguageCode, @NullToUndefined
    graphql/       scalars/ (date, date-time), error-formatter.ts
    clock.ts, clock.module.ts, single-flight.ts, retry.ts
  <module>/        the root holds only the module, service, resolver and clients;
                   entities/      types owned by the module
                   mappers/       stateless injectable classes with methods that translate between layers (API response to domain,
                                  database row to domain, input to cache key)
                   repositories/  Prisma access, returns domain types
                   utils/         other pure helpers (freshness policy, scoring maths and curves)
                   specs/         unit tests; every subfolder has its own specs/ next to the code it covers
  search/          search.module.ts, search.resolver.ts, search.service.ts, geocoding.client.ts
  weather/         weather.module.ts, weather.service.ts, forecast.client.ts, marine.client.ts
  scoring/         scoring.module.ts, scoring.service.ts; entities/ holds the activity definitions (the formulas
                   as data), utils/ holds score-day.ts, curves, combiners, derived features, daily features
  activity-scores/ activity-scores.module.ts, activity-scores.resolver.ts, activity-scores.service.ts,
                   date-range.validator.ts, time-zone.service.ts, mappers/
  health/          health.controller.ts
  observability/   tracing.ts, metrics.ts
test/              e2e specs, fixtures/, support/ (Testcontainers, scripted Open-Meteo)
```

Unit tests are `*.spec.ts` in a `specs/` folder next to the code. Integration tests that need Postgres are
`*.int-spec.ts` in the same place.

Raw SQL is written only as TypedSQL: a `.sql` file in `prisma/sql/` becomes a typed function called with
`$queryRawTyped`. TypedSQL types come from a live database, so `scripts/generate-prisma.mjs` starts a throwaway
PostgreSQL with Testcontainers (or uses `DATABASE_URL`), applies the migrations and runs `prisma generate --sql`.
`postinstall` and `build` run it, so both need Docker or a reachable database. The one exception is the test helper
that truncates tables, because TypedSQL does not accept DDL.

### 3.3 Key interfaces

Scoring:

```ts
type DayOutcome =
  | { kind: 'scored'; score: number }
  | { kind: 'unscored'; reason: 'NO_SEA' | 'NO_SNOW' | 'NO_DATA' };

interface DayContext {
  weather: WeatherDayFeatures | null;                 // null: no usable hours that day
  marine: { hasSea: boolean; features: MarineDayFeatures | null } | null; // null: not requested
}

interface ScoringService {
  score(activities: Activity[], day: DayContext): { activity: Activity; outcome: DayOutcome }[];
  requiredSources(activities: Activity[]): DataSource[];    // 'WEATHER' | 'WAVES'
}
```

An activity is a record, not a class: its sources, gates (the conditions that make a day unscored), factors
(feature, curve, weight), combiner (`weightedSum` or `geometric`), multipliers and caps. A single function,
`scoreFeatures(definition, features)`, reads the record and computes the score. Curve kinds (`piecewise`, `steps`,
`polynomial`, `peakNormalizedGev`), derived features (`humidex`, `divide`) and combiners are small registries.
Indoor sightseeing is a record that is based on the outdoor one (`0.5 + 0.5 * (1 - outdoor)`).

Adding an activity: add its name to `ACTIVITIES` and to the contract enum, then add a record to
`activity-definitions.ts`. A new curve, derived feature or combiner kind is one entry in its registry.

Weather:

```ts
type SourceResult<T> =
  | { status: 'ok'; data: T; fetchedAt: Date; stale: boolean }
  | { status: 'too_old'; fetchedAt: Date }
  | { status: 'unavailable'; cause: 'TEMPORARILY_UNAVAILABLE' | 'RATE_LIMITED' };

interface WeatherService {
  resolveLocation(lat: number, lon: number, timezone: string): Promise<LocationRef>; // find or create
  getForecast(loc: LocationRef, coverThrough: LocalDate): Promise<SourceResult<ForecastData>>;
  getMarine(loc: LocationRef, coverThrough: LocalDate): Promise<SourceResult<MarineData>>;
}
```

### 3.4 Freshness policy (pure function, per source)

```
usable   = snapshot exists
           and now - fetchedAt <= refreshInterval
           and localDate(fetchedAt) + 7 days >= coverThrough      (skipped for marine with hasSea = false)

usable                      -> ok, stale = false
not usable -> fetch (single-flight key "<source>:<locationId>", retry per P6)
  fetch ok                  -> store snapshot, ok, stale = false
  fetch failed, snapshot within MAX_STALE_HOURS -> ok, stale = true (uncovered days become NO_DATA)
  fetch failed, snapshot older                  -> too_old
  fetch failed, no snapshot                     -> unavailable (cause from the failure type)
```

### 3.5 Request flow of `activityScores`

1. `ValidationPipe` checks the shape with class-validator (ranges, date format, activities).
2. Round the coordinates to 2 decimals. Look up the time zone offline. Validate the date range against "today"
   in that zone, using an injected `Clock`.
3. `weather.resolveLocation` finds or creates the `Location` (`latE2`, `lonE2`, `timezone`).
4. The union of `requiredSources` of the requested activities decides what is loaded. Forecast and marine are
   loaded in parallel, each once per request.
5. Hours are grouped into local calendar days with the IANA zone (not `utcOffsetSeconds`, which is wrong across
   a DST change inside the 8 days). Daily features are derived once and shared by all activities.
6. For each activity: combine its source results (P7); if usable, call `evaluate` for every date in the range,
   round, categorise.
7. Map to the contract types. `location.elevation` comes from `Location.elevationM`, which is updated on every
   successful forecast fetch.

### 3.6 Environment variables (P5)

| Name | Default |
|---|---|
| `PORT` | 3000 |
| `DATABASE_URL` | required |
| `OPEN_METEO_FORECAST_URL` | `https://api.open-meteo.com/v1/forecast` |
| `OPEN_METEO_MARINE_URL` | `https://marine-api.open-meteo.com/v1/marine` |
| `OPEN_METEO_GEOCODING_URL` | `https://geocoding-api.open-meteo.com/v1/search` |
| `OPEN_METEO_API_KEY` | unset |
| `OPEN_METEO_TIMEOUT_MS` | 10000 |
| `OPEN_METEO_RETRIES` | 1 |
| `WEATHER_REFRESH_HOURS` | 6 |
| `WAVES_REFRESH_HOURS` | 24 |
| `MAX_STALE_HOURS` | 48 |
| `PLACE_SEARCH_CACHE_DAYS` | 30 |
| `OTEL_ENABLED` | false |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` |

### 3.7 Contract and schema changes

- Contract: add `NO_DATA` to `UnscoredReason`; `ScoredLocation.elevation` becomes `Float`; file moves to
  `contracts/graphql/schema.graphql` (P2).
- Prisma: no model change is needed for these decisions (`Location.elevationM` is already nullable). The draft
  still has to pass `prisma validate` and get its first migration (T01).

### 3.8 Testing strategy

| Level | Scope | Tools |
|---|---|---|
| Unit | scoring, freshness policy, date validation, mappers, zod schemas, HTTP client retry logic, config | Jest, fake `Clock`, injected `fetch` |
| Integration | repositories against real Postgres | Jest, Testcontainers, real migrations |
| e2e | GraphQL over HTTP through the whole app | `@nestjs/testing`, supertest, Testcontainers, `OpenMeteoService` overridden with a scripted fake |

No test ever calls the real Open-Meteo. Every ticket follows TDD: tests first, positive and negative cases.
Single spec files are run during work; the full suite before a commit.

## 4. Tickets

Eight tickets, one document each in [tickets/](tickets/). Every ticket follows TDD and lists its tests first.

| Ticket | Title | Depends on | Unblocks |
|---|---|---|---|
| [T01](tickets/T01-foundation.md) | Foundation: scaffold, config, database, contract, GraphQL bootstrap, Open-Meteo HTTP client, health | none | T02, T03, T04 |
| [T02](tickets/T02-scoring.md) | Scoring: core and the four activity scorers | T01 | T05 |
| [T03](tickets/T03-weather-data.md) | Weather data: forecast and marine clients, persistence, refresh | T01 | T05 |
| [T04](tickets/T04-location-search.md) | Location search | T01 | T06 |
| [T05](tickets/T05-activity-scores.md) | `activityScores`: time zone, date validation, orchestration | T02, T03 | T06, T08 |
| [T06](tickets/T06-containers-observability.md) | Containers and observability | T04, T05 | T07 |
| [T07](tickets/T07-docs-submission.md) | Documentation and submission | T06 | none |
| [T08](tickets/T08-scoring-refinement.md) | Scoring refinement (optional) | T05 | none |

### Topological order and parallel waves

```
Wave 1        Wave 2                Wave 3      Wave 4      Wave 5

              T02 scoring ------+
T01 --------> T03 weather data -+-> T05 ------> T06 ------> T07
foundation    T04 search -------|-------------^
                                +-> (T08 optional, any time after T05)
```

| Wave | Tickets | Can run in parallel |
|---|---|---|
| 1 | T01 | no, everything depends on it |
| 2 | T02, T03, T04 | yes, all three |
| 3 | T05 | T04 may still be in progress next to it |
| 4 | T06 | T08 may run next to it |
| 5 | T07 | no, it describes the finished state |

A valid serial order is T01, T02, T03, T04, T05, T06, T07, T08. The critical path is T01, T03, T05, T06, T07.

What makes wave 2 safe to run in parallel:

- T01 creates empty module shells (`scoring`, `weather`, `search`, `activity-scores`) already registered in
  `app.module.ts`, with stub resolvers for both queries. Later tickets only add files inside their own directory.
- T01 finalises the whole Prisma schema, the first migration and the contract file. No later ticket needs a
  migration or a contract change.
- T01 delivers the shared Open-Meteo HTTP client, so T03 and T04 do not wait for each other.
- T02 touches only `src/scoring`, T03 only `src/weather`, T04 only `src/search`, and each has its own fixtures
  folder under `test/fixtures/`.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Very recent major versions (NestJS 12, Prisma 7, TypeScript 7, Jest 30) may not work together out of the box | T01 pins exact versions and proves the toolchain before any feature work. |
| Prisma 7 generated client is emitted as TypeScript with a required output path | Generated into `src/generated`, ignored by git and lint, generated in `postinstall` and in the Docker build. |
| Fixture values for the spec events lack humidity | T02 re-reads them from the archive once and commits them as static fixtures. |
| Testcontainers slows the feedback loop | Only `*.int-spec.ts` and e2e use it, one container per run, and single spec files are run during work. |
