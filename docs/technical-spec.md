# Technical specification

Everything needed to write an implementation plan for this service. It collects what was decided, the data
behind the decisions, and what is still open. Short decision log: [DECISIONS.md](../DECISIONS.md). Contracts:
[schema.graphql](../contracts/graphql/schema.graphql) and [prisma/schema.prisma](../prisma/schema.prisma).

Status words used below:

- **Decided**: confirmed by the project owner.
- **Proposal**: suggested during design, not yet confirmed. Decide in the implementation plan.
- **Verify**: a fact that was not confirmed against a primary source.

## 1. Purpose and constraints

The brief is [TASK.md](../TASK.md): a Node.js + GraphQL backend that ranks how good upcoming days are for skiing,
surfing, outdoor sightseeing and indoor sightseeing in a given place, using Open-Meteo data that is persisted
rather than fetched on every request. No front end.

What is evaluated, in order: how the work was done (reasoning, assumptions, cuts), then the service and a short
README. A focused submission that reasons well beats an exhaustive one. Where a product manager would normally be
asked, the question and the assumption taken are written down in DECISIONS.md.

Deliverables still to produce: the service, README (what, how to run, assumptions, Open-Meteo attribution), and
the AI session trail in `ai-sessions/`.

Repository conventions are in [AGENTS.md](../AGENTS.md): English everywhere, Conventional Commits, commit to
`main`, minimal code comments, and no assumptions recorded without the owner's confirmation.

## 2. Product behaviour (decided)

- A user picks a place and gets, for each day in a requested range and for each activity, a score from 0 to 1
  and a category from 1 to 8. The scenario: a traveller arriving in a city who wants to know which day suits
  skiing and which day suits seeing the city.
- Scoring is per day and per activity. The API does not return a rank; clients sort by score.
- Scores of different activities are meant to be comparable, so a client can rank activities within a day.
  This is approximate (see section 8).
- The service works for any coordinates on Earth. "Regional" describes expected audience and load only: a user in
  Poland planning a trip to the Alps must be able to use it.
- The audience is small and load is low (assumption, to be checked with the team). Availability and latency
  targets were not discussed.

### Two steps

1. `searchLocations(name, ...)` finds places and returns coordinates.
2. `activityScores(input)` takes coordinates only.

Reason: a city name plus country does not identify a place, and coordinates let any consumer (for example a map
picker) supply a location. Location search and weather ranking are separate modules and must stay loosely
coupled: no foreign keys between their tables and no imports of each other's models, so each can become its own
service with its own database.

## 3. API contract (decided)

The full contract is [schema.graphql](../contracts/graphql/schema.graphql). It is written by hand and does not expose
internal details (no mention of Open-Meteo, caching or limits). Summary:

| Operation | Input | Output |
|---|---|---|
| `searchLocations` | `name`, `count` (1 to 100, default 10), `countryCode`, `language` (default `en`) | list of `Place`, empty when nothing matches |
| `activityScores` | `latitude`, `longitude`, `fromDate`, `toDate`, `activities` (default all four) | `location` plus one `ActivityScoresResult` per requested activity |

Per activity the result is one of:

| Type | Meaning |
|---|---|
| `ActivityDayScores` | `days` (one `ScoredDay` or `UnscoredDay` per date) and `freshness` per data kind |
| `ActivityDataTooOld` | stored data exists but is older than the limit and could not be refreshed; carries `lastUpdatedAt` |
| `ActivityDataUnavailable` | no data at all; `cause` is `TEMPORARILY_UNAVAILABLE` or `RATE_LIMITED` |

A day is either `ScoredDay` (`score`, `categoryIndex`, `category`, all non-null) or `UnscoredDay` (`reason` is
`NO_SEA` or `NO_SNOW`). Nullable fields are avoided on purpose so that invalid combinations such as a null score
with a category cannot be expressed. A failed activity does not fail the others.

`freshness` has an entry per data kind the activity used (`WEATHER`, plus `WAVES` for surfing), each with
`updatedAt` (the time data was actually fetched) and `stale` (a refresh was due but failed, so older data was used).

### Input validation (decided)

Shape, with class-validator: latitude -90 to 90, longitude -180 to 180, dates as `YYYY-MM-DD`, place search
`count` 1 to 100.

Dates, with "today" taken in the time zone of the location:

- `fromDate` is less than or equal to `toDate`.
- `fromDate` is today or later.
- `toDate` is at most 7 days after today. The range always lies inside the 8 days that are fetched (today and
  the next 7), so it is at most 8 days long.

The time zone used for "today" is determined offline from the coordinates, so validation does not call
Open-Meteo. Any violation is a validation error returned before scores are computed.

Dates have no time component because Open-Meteo daily data is keyed by calendar date (a datetime in `start_date`
returns HTTP 400).

## 4. Data source: Open-Meteo

Free tier, no API key, JSON over GET. Data is CC BY 4.0, so attribution goes in the README. The free tier is for
non-commercial use. Production is assumed to run on a paid plan with higher limits (assumption).

| API | Base URL | Used for |
|---|---|---|
| Geocoding | `https://geocoding-api.open-meteo.com/v1/search` | `searchLocations` |
| Forecast | `https://api.open-meteo.com/v1/forecast` | weather for skiing, outdoor, indoor, and wind for surfing |
| Marine | `https://marine-api.open-meteo.com/v1/marine` | waves for surfing |

Limits and counting:

- Free tier: 600 calls per minute, 5,000 per hour, 10,000 per day, 300,000 per month.
- A request counts as one call up to 10 weather variables and 2 weeks. More than that counts as several calls.
  The forecast request uses exactly 10 hourly variables and 8 days, so one call.
- Errors are HTTP 400 with `{"error": true, "reason": "..."}`. Exceeding limits returns HTTP 429.

Behaviours observed while researching:

- Geocoding: when nothing is found the response is HTTP 200 without a `results` key. `count` is 1 to 100.
- Forecast supports up to 16 days. Marine supports up to 8 days.
- Marine returns HTTP 200 with null values for inland points. With the default `cell_selection=land`, coastal
  cities (Barcelona, Sydney, Nice, Singapore, Hossegor, Honolulu) also returned null. `cell_selection=sea`
  returns the nearest sea cell (shifted by roughly 5 to 10 km) for coastal points and still returns null for
  inland ones (Madrid, Vienna, Munich, Denver). `nearest` was unreliable.
- Marine wave height is the value in that sea cell, not at a specific beach. Sheltered bays correctly give small
  waves.
- `snow_depth` exists only as an hourly variable, not daily.
- Hourly forecast data starts at 00:00 of the current day in the requested time zone.
- The response contains the grid point actually used (`latitude`, `longitude`), `elevation`, `timezone` and
  `utc_offset_seconds`.
- Time can be requested as unix timestamps with `timeformat=unixtime` (Verify in the implementation).

### Requests the service makes (proposal)

Forecast, always 8 days from today, regardless of the requested range:

```
GET /v1/forecast?latitude=..&longitude=..&forecast_days=8&timezone=<tz>&timeformat=unixtime
  &hourly=temperature_2m,relative_humidity_2m,precipitation,rain,snowfall,snow_depth,cloud_cover,
          wind_speed_10m,wind_gusts_10m,weather_code
```

Marine:

```
GET /v1/marine?latitude=..&longitude=..&forecast_days=8&timezone=<tz>&timeformat=unixtime&cell_selection=sea
  &hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period
```

Default units apply: temperature in degrees Celsius, wind in km/h, precipitation in mm, snowfall in cm,
snow depth in metres, waves in metres and seconds.

Passing the offline-determined time zone as `timezone` keeps day boundaries identical between validation and
data. Using `timezone=auto` instead could disagree near zone borders.

## 5. Data model and refresh

The schema is [prisma/schema.prisma](../prisma/schema.prisma) (draft, not yet validated with `prisma validate`).

Decided:

- PostgreSQL is the only store. No Redis, no PostGIS, no shared limit counter.
- Typed columns only, no JSONB. Table and column names are not remapped, so they are PascalCase and camelCase
  in Postgres (quoted identifiers in raw SQL).
- Coordinates are rounded to 2 decimals (about 1.1 km) before any use and stored as integers (degrees x 100)
  with a unique key on the pair.
- Raw hourly data is stored as received (after zod validation). Daily aggregates and scores are derived at read
  time, so changing the scoring needs no data migration.
- Every fetch is stored as a new snapshot with its fetch time. Reads take the newest snapshot per location and
  source (`ORDER BY fetchedAt DESC, id DESC LIMIT 1`). Cleaning old snapshots is out of scope.
- An inland location still gets a marine snapshot with `hasSea = false` and no hour rows, so the Marine API is not
  called again on every request.
- Place search results are stored too (tables `Place`, `PlaceSearch`, `PlaceSearchHit`), so repeated searches
  do not hit the geocoder. The cache lifetime is not decided (geocoding data rarely changes).
- Metadata columns: `createdAt` and `updatedAt` on every table except the two hour tables; `parserVersion` on
  the two snapshot tables (to tell which mapping logic wrote a row).

Refresh rules (decided):

| Source | Refresh interval | Why |
|---|---|---|
| Forecast | 6 hours | the model (GFS) itself updates every 6 hours |
| Marine | 24 hours | waves change slowly: a 24-hour-old cache differs by about 0.07 m for tomorrow |
| Hard limit for stale data | 48 hours, all sources | see section 7 |

Data is fetched on demand: a request that needs data older than its interval triggers a fetch. There is no
background job.

### Request flow (proposal built from the decisions)

1. Validate input shape. Normalize coordinates (round to 2 decimals).
2. Determine the time zone offline and validate the dates.
3. Find or create the `Location`.
4. For each requested activity, collect the sources it needs (weather, plus waves for surfing).
5. For each source, read the newest snapshot. If its age is within the interval, use it.
6. Otherwise fetch (single-flight, one retry). On success store a new snapshot and use it.
7. On failure: use the stored snapshot if it is within 48 hours and mark it `stale`. If it is older than 48 hours
   the activity is `ActivityDataTooOld`. If there is none, the activity is `ActivityDataUnavailable`.
8. Derive daily features from the hourly rows, apply each activity's scorer, map to the response.

### Concurrency (decided)

- Fetches of the same location and source inside one instance are deduplicated with an in-memory map of
  in-flight promises.
- A race between instances is accepted. Writes are append-only, so the cost is at most one extra stored row.
  A `pg_try_advisory_xact_lock` was considered and dropped as unnecessary at this scale.

## 6. Error handling (decided)

| Situation | Behaviour |
|---|---|
| Fresh fetch succeeds | use it |
| Fetch fails, stored data within 48 hours | return it, `stale: true`, with the time it was fetched |
| Fetch fails, stored data older than 48 hours | that activity is `ActivityDataTooOld` |
| Fetch fails, no stored data | `ActivityDataUnavailable`, cause by failure type |
| Open-Meteo returns 429 | same as above, cause `RATE_LIMITED`; no counter is kept |
| Waves unavailable | only surfing is affected |
| Weather unavailable | every activity is affected, because all of them need weather |

Requests to Open-Meteo are retried once. The timeout and retry settings are environment variables (names and
default values are a proposal for the plan; a timeout of about 10 seconds was suggested).

## 7. Refresh and staleness measurements

Measured on Open-Meteo itself (GFS model runs). These justify the 6 hour, 24 hour and 48 hour numbers.

Difference between a score from a cached run and a score from a fresh run for the same target day
(mean absolute difference, and share of cases where the category changed by 2 or more classes):

| Activity | Target | 6 h | 12 h | 24 h | 48 h | 72 h |
|---|---|---|---|---|---|---|
| Outdoor | tomorrow | 0.029 / 3% | 0.037 / 3% | 0.046 / 3% | 0.051 / 4% | 0.072 / 10% |
| Outdoor | +3 days | 0.035 / 0% | 0.041 / 2% | 0.053 / 4% | 0.069 / 8% | 0.087 / 14% |
| Outdoor | +7 days | 0.076 / 10% | 0.090 / 17% | 0.103 / 21% | 0.116 / 25% | not measured |
| Skiing | tomorrow | 0.027 / 2% | 0.031 / 2% | 0.042 / 3% | 0.074 / 8% | 0.077 / 6% |
| Skiing | +3 days | 0.051 / 5% | 0.051 / 5% | 0.058 / 6% | 0.117 / 12% | 0.144 / 17% |
| Skiing | +7 days | 0.107 / 7% | 0.143 / 8% | 0.149 / 9% | 0.194 / 17% | not measured |

Reading: for skiing the change on the nearest days roughly doubles between 24 and 48 hours (0.058 to 0.117 at +3
days). For outdoor it grows more gradually and stays under half a class width up to 48 hours, then rises at 72
hours. Far days are noisy even with a fresh cache. A 24 hour limit would have been tighter; 48 hours was chosen as
a single limit for all sources.
Setup: 6 locations for outdoor and 3 southern-hemisphere ski locations, July 2026, one model, 80 to 500 cases per
cell. Waves could not be measured this way (no single-run archive); a 24 hour old wave cache differed by about
0.07 m for tomorrow and a 48 hour old one by about 0.11 m.

Forecast skill by lead time (a forecast made N days ahead versus the latest value, average over 6 cities, 60 days):

| Lead | Max temperature error | Rain/no-rain agreement | Max wind error |
|---|---|---|---|
| 1 day | 0.7 C | 85% | 2.3 km/h |
| 3 days | 1.2 C | 81% | 3.9 km/h |
| 5 days | 1.7 C | 76% | 4.1 km/h |
| 7 days | 2.1 C | 70% | 5.6 km/h |

## 8. Scoring specification (decided)

Pure functions over daily features. Parameters should live in one place and be versioned (`parserVersion`
covers the mapping of raw data; scoring parameters can change without data migration).

### 8.1 Daily features

Hours are grouped into calendar days in the location time zone. For one day:

| Feature | Definition |
|---|---|
| `tMax` | maximum `temperature_2m` |
| `rhMean` | mean `relative_humidity_2m` |
| `precip` | sum of `precipitation` (mm) |
| `rain` | sum of `rain` (mm) |
| `snowfallSum` | sum of `snowfall` (cm) |
| `snowDepthMax` | maximum `snow_depth` (m) |
| `snowHours` | number of hours with `snowfall > 0` |
| `cloud` | mean `cloud_cover` (%) |
| `windMean` | mean `wind_speed_10m` (km/h) |
| `windMax` | maximum `wind_speed_10m` (km/h) |
| `waveHeight` | maximum `wave_height` (m) |
| `wavePeriod` | maximum `wave_period` (s) |

Nulls in the upstream data must be handled (skip them when aggregating; treat a day with no usable hours as
unavailable).

### 8.2 Skiing

Source: Skiing Utility Index, Kapetanakis et al., 2022, Atmosphere 13(10):1569, based on a survey of 111 skiers
at one Greek resort. The utility functions were read from the paper PDF.

- Unscored (`NO_SNOW`) when `snowDepthMax = 0` and `snowfallSum = 0`.
- `uSnow = clamp((98.05 + 6.39 S - 9.03 S^2 + 0.81 S^3) / 100)` with `S = snowHours`, and 0 when `S > 5`.
- `uWind = clamp((104.37 - 6.78 w - 0.19 w^2 + 0.01 w^3) / 104.37)` with `w = windMean / 3.6` (m/s).
- `uTemp = f(tMax) / max(f)` where `f(x) = (1/s) * g^(1/c - 1) * exp(-g^(1/c))`, `g = 1 - c (x - loc) / s`,
  `c = 0.34`, `loc = 1.45`, `s = 4.6`, and `f = 0` when `g <= 0`. The peak is near 3 C, the function is zero
  below about -12 C and above about 15 C.
- `uCloud = clamp((100 - cloud) / 75)`, so 1 at 25% or less.
- `SUI = 0.303 uSnow + 0.279 uWind + 0.222 uTemp + 0.194 uCloud`.
- `score = SUI * clamp(1 - rain / 3) * min(1, snowDepthMax / 0.3)`.

The rain multiplier (3 mm) and the snow depth multiplier (0.3 m) are our additions, not from the paper. The
paper only states that most skiers avoid rain, and it has no snow depth criterion. The snow depth multiplier was
added after validation (section 9).

### 8.3 Surfing

No academic index exists; thresholds come from surf forecasting practice (meteoblue, Surf-Forecast, Rapture
Camps). General or intermediate surfer; no skill parameter in the request.

- Unscored (`NO_SEA`) when the marine snapshot has `hasSea = false`.
- Each factor is piecewise linear through the anchors, flat outside them:

| Factor | Variable | Anchors (value to utility) |
|---|---|---|
| Wave height | `waveHeight` (m) | 0.3 to 0, 0.8 to 0.6, 1.0 to 1, 2.0 to 1, 3.0 to 0.5, 4.0 to 0 |
| Wave period | `wavePeriod` (s) | 5 to 0, 8 to 0.4, 10 to 0.7, 13 to 1 |
| Wind | `windMax` (km/h) | 15 to 1, 25 to 0.7, 40 to 0.3, 55 to 0 |

- `score = 0` if any utility is 0, otherwise `uHeight^0.35 * uPeriod^0.35 * uWind^0.30`.

Known limit: wind direction (offshore versus onshore) is the main factor for real surf quality but cannot be
used, because the API does not know the orientation of the coast.

### 8.4 Outdoor sightseeing

Holiday Climate Index: Urban (HCI:Urban), Scott, Rutty, Amelung and Tang, 2016, Atmosphere 7(6):80. The rating
tables were checked against the original paper. The thermal comfort variable follows the later update by the
same authors (Rutty et al., 2020, Atmosphere 11(4):412), which replaced effective temperature with humidex.

`HCI = 4 * TC + 2 * A + 3 * P + W`, then `score = clamp(HCI / 100)`. Each rating is 0 to 10, precipitation and
wind can be negative.

Thermal comfort rating, from the Canadian humidex of `T = tMax` (C) and `RH = rhMean` (%):

`humidex = T + 5/9 * (6.112 * 10^(7.5 T / (237.7 + T)) * RH / 100 - 10)`

| Humidex (C) | Rating | Humidex (C) | Rating |
|---|---|---|---|
| below -6 | 1 | 26 to 26.99 | 9 |
| -5.99 to -0.01 | 2 | 27 to 28.99 | 8 |
| 0 to 6.99 | 3 | 29 to 30.99 | 7 |
| 7 to 10.99 | 4 | 31 to 32.99 | 6 |
| 11 to 14.99 | 5 | 33 to 34.99 | 5 |
| 15 to 17.99 | 6 | 35 to 36.99 | 4 |
| 18 to 19.99 | 7 | 37 to 38.99 | 2 |
| 20 to 22.99 | 9 | 39 and above | 0 |
| 23 to 25.99 | 10 | | |

Cloud cover `A` (mean %): 0 to 8; 1 to 10.99 to 9; 11 to 20.99 to 10; 21 to 30.99 to 9; 31 to 40.99 to 8;
41 to 50.99 to 7; 51 to 60.99 to 6; 61 to 70.99 to 5; 71 to 80.99 to 4; 81 to 90.99 to 3; 91 to 99.99 to 2;
100 to 1.

Precipitation `P` (daily mm): 0 to 0.01 to 10; 0.02 to 2.99 to 9; 3 to 5.99 to 8; 6 to 8.99 to 5;
9 to 11.99 to 2; 12 to 24.99 to 0; 25 and above to -1.

Wind `W` (`windMean`, km/h): 0 to 0.01 to 8; 0.02 to 9.99 to 10; 10 to 19.99 to 9; 20 to 29.99 to 8;
30 to 39.99 to 6; 40 to 49.99 to 3; 50 to 69.99 to 0; 70 and above to -10.

Two caps are our additions, applied after the index (both added after validation, section 9):

- if `precip >= 6` then `score = min(score, 0.5)`;
- if `windMax >= 60` or `precip >= 25` then `score = min(score, 0.2)`.

Why humidex and not effective temperature: Scott 2016 used effective temperature but does not print a formula
(Mieczkowski's TCI reads it from an ASHRAE chart), so it cannot be reproduced exactly. Rutty 2020 moved
HCI:Urban and HCI:Beach to humidex with the same rating bands (Table 3 of that paper), and the humidex formula is
printed in Atmosphere 11(9):911, eq. 1. Humidex also handles dry heat correctly: at 42 C and 25% humidity
effective temperature gives a rating of 6, humidex gives 0. In humid tropics humidex rates most days 0
(Singapore at 32.8 C and 86% humidity is 50.9, rating 0), which is the known behaviour of that index.

### 8.5 Indoor sightseeing

No dedicated index exists in the research; this is our own model. `score = 0.5 + 0.5 * (1 - outdoor)`, using the
outdoor score after the caps. The range is 0.5 to 1.0. It is never unscored. Because it is derived from outdoor,
comparing indoor with outdoor is partly circular.

### 8.6 Categories

The same 8 classes apply to every activity (HCI classes, first two renamed):

| Index | Category | Score |
|---|---|---|
| 1 | UNSUITABLE | 0 to 0.09 |
| 2 | POOR | 0.10 to 0.39 |
| 3 | MARGINAL | 0.40 to 0.49 |
| 4 | ACCEPTABLE | 0.50 to 0.59 |
| 5 | GOOD | 0.60 to 0.69 |
| 6 | VERY_GOOD | 0.70 to 0.79 |
| 7 | EXCELLENT | 0.80 to 0.89 |
| 8 | IDEAL | 0.90 to 1.00 |

### 8.7 Activity abstraction (decided in principle, details proposal)

Each activity sits behind one interface so a new activity is a new class plus a registration, with no change to
the others. Suggested members: an identifier, the data sources it requires (this drives which sources are
fetched and the rule that a failure affects only dependent activities), a rule for when a day is unscored, and
the score function over daily features.

## 9. Validation of the scoring

The formulas were checked against historical data (Open-Meteo archive and marine history), with events whose
outcome is documented. This is a sanity check, not a statistical validation.

Dated events, with the humidex thermal comfort used by the final scoring (outdoor before and after the two caps):

| Place and date | What happened | Observed daily values | Outdoor before caps | Outdoor after caps | Indoor after |
|---|---|---|---|---|---|
| Hong Kong 2023-09-01 | Typhoon Saola, signal 10 | tMax 25.4, precip 61.3, wind mean 30.8 / max 63.5, cloud 100 | 0.23 | 0.20 | 0.90 |
| Hong Kong 2023-09-02 | signal 10 still in force | tMax 27.4, precip 68.2, wind 30.4 / 51.1, cloud 87 | 0.09 | 0.09 | 0.96 |
| London 2022-02-18 | Storm Eunice, first red wind warning, attractions closed | tMax 11.3, precip 2.6, wind 36.7 / 68.0, cloud 64 | 0.63 | 0.20 | 0.90 |

With effective temperature instead of humidex, the two Hong Kong days scored 0.47 and 0.45 before the caps, so
the caps were first motivated by them. With humidex the humid heat already pulls those days down, and the caps
are needed for the London case: a dry, cool storm where the index stays high because wind has a weight of 1 out of
10.

| Place and date | What happened | Skiing before | Skiing after |
|---|---|---|---|
| Beaver Creek 2022-12-02 | World Cup downhill cancelled, wind and snow | 0.46 | 0.46 |
| Beaver Creek 2023-12-01 | cancelled, second day | 0.36 | 0.13 |
| Beaver Creek 2023-12-02 | cancelled, snowfall and heavy wind | 0.28 | 0.14 |

Coordinates used: Hong Kong 22.30, 114.17; London 51.51, -0.13; Beaver Creek 39.60, -106.52.

Seasonality (mean score per month, three years of data), compared with documented seasons:

| Place | Documented season | Result |
|---|---|---|
| Hossegor | September and October best, summer weak | September 0.78 is the highest, October and May 0.75; summer 0.62 to 0.69; narrow range |
| Jeffreys Bay | June to August best | peak in May (0.82) and July (0.80); the year ranges from 0.71 to 0.82 |
| Uluwatu | April to October (dry season) | wet-season months score as high as dry ones; no wind direction in the model |
| Singapore | no natural surf | 0 all year |
| Chamonix | December to April | 0.53 to 0.69 in season, 0.26 to 0.37 in the off-season, null in July and August |
| Aspen | December to March | October scored 0.60 before the snow depth multiplier existed |

Side effect check of the storm cap: the share of normal days in 2023 where the cap triggers was 0% in London,
1% in Lisbon and Denver, 2% in Wellington, 4% in Reykjavik.

Limitations:

- ERA5 reanalysis, not forecasts. Real forecast error adds on top.
- A handful of events and places, one to three years.
- The two caps and the snow depth multiplier were derived from the same events they were then checked on, so the
  improvement is not independent evidence. There is no independent set of storm days. With humidex the storm
  caps rest on a single documented event (Storm Eunice); Typhoon Saola is already low without them.
- The Splugen slope closure on 2023-01-01 was dropped as a test case because the source did not give that date.
- Surfing without wind direction and skiing in the off-season (snow present at high grid cells, so not null)
  were not fixed. Scoring refinement was deliberately postponed to the end of the work.

## 10. Stack and tooling (decided unless marked)

| Concern | Choice |
|---|---|
| Language, framework | TypeScript, NestJS |
| API | GraphQL, contract written by hand, not generated from the database models |
| Request validation | class-validator |
| Upstream response validation | zod |
| Database access | Prisma with PostgreSQL |
| Health | endpoint reporting only our own service; it must not call Open-Meteo |
| Observability | OpenTelemetry with grafana/otel-lgtm, behind a flag |
| Containers | a Dockerfile per runnable thing and one docker compose for local run |
| Tests | unit tests for everything, e2e tests with the NestJS testing tools and a mocked Open-Meteo |

Versions found in the npm registry on 2026-10-12 (Verify before pinning):

- `@nestjs/graphql` 14.x and `@nestjs/apollo` 14.x require NestJS 12 and `graphql` 16.11 or 17;
  `@nestjs/apollo` also needs `@apollo/server` 5. Mercurius is the other driver. The driver is not chosen.
- `@prisma/client` 7.10.0 is the stable line. The `prisma` CLI `latest` tag pointed to an 8.0 release candidate,
  so pin the CLI to 7.x.
- Prisma 7: the generator is `prisma-client` with a required `output`, the datasource block has no `url` (it
  lives in `prisma.config.ts`), and the client needs a driver adapter (`@prisma/adapter-pg`).
- Prisma has no GraphQL-generating tooling worth using here: `prisma-nestjs-graphql` is maintained but generates
  types for models, which does not match our contract. `drizzle-graphql` has not been released since 2024.
- `createMany` is enough for inserting the 192 hour rows of a snapshot; upsert is only needed for `Location`
  and `Place`.

### Module layout (proposal)

| Module | Responsibility |
|---|---|
| search | geocoding client, place repository and cache, `searchLocations` resolver |
| weather | forecast and marine clients, snapshot repository, refresh with single-flight, freshness policy |
| scoring | daily feature derivation, activity interface and four implementations, categories (pure, no database) |
| activity scores | orchestration: validation, data access, scoring, mapping to the contract |
| health | service health |
| config | environment variables parsed and validated with zod |

The search and weather modules must not depend on each other.

### Environment variables (proposal)

Database URL, Open-Meteo base URLs, optional Open-Meteo API key, request timeout, retry count (default 1),
weather refresh hours (6), waves refresh hours (24), maximum stale hours (48), place search cache lifetime.

### Observability (proposal)

Traces for incoming requests and outgoing Open-Meteo calls; counters for snapshot reuse, refreshes, refresh
failures and stale responses; structured logs. Started only with a compose profile, so the default
`docker compose up` runs the application and Postgres.

### Testing (decided in principle)

- Unit: derived features, each activity scorer, categories, date validation, freshness policy, mapping.
- Scoring fixtures: the events in section 9 give real daily feature values with expected ordering.
- e2e: NestJS testing module with Open-Meteo replaced by a mock, never calling the real API. How Postgres is
  provided to the e2e tests (a compose service or a throwaway container) is not decided.

## 11. Out of scope and cut

- Authentication and rate limiting of our own API (to be discussed separately).
- Cleaning up stored snapshots (little data at the expected scale; fetching is on demand).
- A background refresh job (on demand was chosen).
- A shared counter for Open-Meteo limits and Redis (an error is returned when Open-Meteo fails and there is no
  stored data).
- Cross-instance locking of refreshes.
- Wind direction for surfing, skill levels for surfing, resort-level ski data.

## 12. Open items for the implementation plan

| Item | Note |
|---|---|
| Time zone for day grouping | pass the offline time zone to Open-Meteo so validation and grouping agree; `ScoredLocation.timezone` is then that value |
| Offline time zone library | not chosen (for example `tz-lookup`) |
| Place search cache lifetime | not decided |
| Names and defaults of environment variables | proposal above |
| GraphQL driver (Apollo or Mercurius) | not decided |
| How e2e tests get Postgres | not decided |
| `parserVersion` | needs a documented meaning (which number is which mapping) |
| `prisma validate` and first migration | the schema has not been run through Prisma yet |
| Optional Open-Meteo API key | for the paid plan, header or query parameter per their documentation |
| Scoring refinement | postponed to the end; see limitations in section 9 |
| Assumptions to check with the team | load, regional scope, coordinates-only ranking, 48 hour limit |

## 13. Sources

- Kapetanakis, Georgopoulou, Mirasgedis et al., Weather Preferences for Ski Tourism: An Empirical Study on the
  Largest Ski Resort in Greece, Atmosphere 2022, 13(10):1569, doi:10.3390/atmos13101569.
- Scott, Rutty, Amelung, Tang, An Inter-Comparison of the Holiday Climate Index (HCI) and the Tourism Climate
  Index (TCI) in Europe, Atmosphere 2016, 7(6):80, doi:10.3390/atmos7060080.
- Holiday Climate Index tables as reproduced in Climate 2023, 11(48), Appendix A.
- Open-Meteo documentation: forecast, marine, geocoding, previous runs and single runs APIs, and pricing page
  for call counting.
- Surfing thresholds: meteoblue sea and surf guide, Surf-Forecast FAQ and break pages, Rapture Camps forecast
  basics.
- Events: Hong Kong Observatory report on Typhoon Saola; Storm Eunice coverage (Euronews); Beaver Creek World
  Cup cancellations (CPR); Surf-Forecast season pages for Hossegor and Jeffreys Bay.
