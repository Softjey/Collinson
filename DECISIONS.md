# Decisions

> Running log of decisions, open questions, assumptions, and things that were cut (with a one-line reason).

## Ranking granularity and output

**Question (for PM):** The brief says "ranks how good the next 7 days will be for each of these activities". Is the ranking one verdict for the whole week, or a separate one per day?

**Decision:**

- Each activity is evaluated separately for each of the 7 days.
- The API returns a `score` for every activity on every day.
- The API does not return a `rank`; sorting by `score` is left to the client.

**Why:** A traveller arriving in a new city wants to know which day suits skiing and which day suits sightseeing. A concrete per-day answer is more useful than a weekly aggregate.

## Date range

**Decision:**

- The API takes `fromDate` and `toDate` instead of a fixed "next 7 days".
- The range is limited to 8 days, matching the Open-Meteo Marine API (forecast supports up to 16).
- The values are dates without a time, because the Open-Meteo daily endpoints accept only dates (a datetime returns a 400).
- Validation of the date range, with "today" taken in the time zone of the location:
  - `fromDate` is less than or equal to `toDate`;
  - `fromDate` is today or later;
  - `toDate` is at most 7 days after today, so the range always lies within the 8 days that are fetched (today and the next 7). This also makes the range at most 8 days long.
- The time zone used for "today" is determined offline from the coordinates, so validation does not need a call to Open-Meteo.
- Validation of the input shape (class-validator): latitude from -90 to 90, longitude from -180 to 180, dates in `YYYY-MM-DD` form, a place search count from 1 to 100.
- Any violation is rejected with a validation error before scores are computed.

**Why:** The client asks only for what it needs, which makes the API more convenient and flexible. Marine data, needed for surfing, only covers 8 days.

## Supported locations

**Decision:**

- Any location is supported, i.e. anything Open-Meteo accepts by coordinates.
- If an activity is not possible at a location at all, its `score` is `null` instead of a low number.
- Surfing is `null` when there is no sea, since it is impossible without one. The Marine API is queried with `cell_selection=sea`, and "no sea" means all wave values are `null`. With the default `land` selection, coastal cities such as Barcelona, Sydney and Nice returned `null`.
- Skiing is `null` for a given day when there is no snow on the ground and no snowfall that day. This is decided per day, not for the whole range.
- Outdoor sightseeing and indoor sightseeing always have a number; bad weather is a low score, never `null`.

## Scoring

**Decision:**

- Each activity has its own criteria, and the score is computed from them on a scale from 0 to 1.
- The criteria are based on published research and on real data returned by Open-Meteo, not on invented rules.
- Scores of different activities should be comparable, so they can be ranked against each other.
- Surfing assumes a general/intermediate surfer.
- Indoor sightseeing has a baseline of 0.5 and grows when the weather is bad outdoors (no dedicated research, our own modelling).
- Outdoor sightseeing score is capped at 0.5 when daily precipitation is 6 mm or more.
- Outdoor sightseeing score is capped at 0.2 when daily maximum wind is 60 km/h or more, or daily precipitation is 25 mm or more. Added after validation on historical storm days (Typhoon Saola, Storm Eunice), where plain HCI scored them 0.47 and 0.63.
- Skiing score is multiplied by `min(1, snow_depth_m / 0.3)`, so a thin snow base lowers the score. Added after validation: without it, early-season days scored as high as mid-winter ones (Aspen, October).

**Criteria (confirmed):**

- **Skiing:** Skiing Utility Index (Kapetanakis et al., 2022). Weights: snowfall duration 0.303, wind 0.279, daily max temperature 0.222, cloud cover 0.194, with the utility functions from the paper. The score is multiplied by `(1 - rain_mm / 3)` (our assumption; the paper only states that most skiers avoid rain). A day is `null` when snow depth is 0 and snowfall is 0.
- **Surfing:** wave height 0.35, wave period 0.35, wind 0.30, combined as a weighted geometric mean, so a flat or blown-out day scores 0. Anchors come from surf-forecasting practice: wave height 0.3 m → 0, 0.8 → 0.6, 1-2 → 1, 3 → 0.5, 4 → 0; period 5 s → 0, 8 → 0.4, 10 → 0.7, 13 → 1; wind ≤15 km/h → 1, 25 → 0.7, 40 → 0.3, 55 → 0.
- **Indoor sightseeing:** `0.5 + 0.5 * (1 - outdoor)`, using the outdoor score after the precipitation cap.
- **Outdoor sightseeing:** HCI:Urban (Scott et al., 2016) with its rating tables, checked against the original paper: `4 * thermal comfort + 2 * cloud cover + 3 * precipitation + wind`. Thermal comfort uses effective temperature from daily max temperature and mean relative humidity, as in the paper.

## Score presentation

**Decision:**

- The API returns a `score` and a category index (1-8) for each activity, with no explanation of how the score was computed.
- The category index uses the 8 HCI classes, applied to all four activities, with the first two renamed for our case: 1 Unsuitable (0-0.09), 2 Poor (0.10-0.39), 3 Marginal (0.40-0.49), 4 Acceptable (0.50-0.59), 5 Good (0.60-0.69), 6 Very good (0.70-0.79), 7 Excellent (0.80-0.89), 8 Ideal (0.90-1.00).
- The client decides whether to show the score and how to interpret it, or to show only a ranking.
- The score is on a scale from 0 to 1 (see Scoring).

## Data refresh frequency

**Decision:**

- Weather data (Open-Meteo Forecast) is refreshed every 6 hours.
- Wave data (Open-Meteo Marine) is refreshed every 24 hours.

**Why:** There is no stated freshness requirement, so this is based on measurements against Open-Meteo.

- The weather model (GFS) itself updates every 6 hours, so refreshing more often gives no new data.
- A cached forecast for tomorrow that is 6-12 hours old differs from a fresh one by under 0.5 °C; for days further out the forecast fluctuates between runs regardless of cache age, so refreshing more often adds noise rather than accuracy.
- Wave forecasts change more slowly than weather: for tomorrow, a 24-hour-old cache differs by about 0.07 m (4%) from a fresh one.

## Audience and load

**Question (for the team):** What load, availability and latency are expected, and is the service regional or worldwide?

**Assumption:**

- The audience is small, so the service is built for low load.
- The service is regional rather than worldwide.
- "Regional" describes the audience and load, not a restriction on locations: a user in Poland planning a trip to the Alps must be able to use it.
- This is only an assumption to be checked with the team.
- Open-Meteo rate limits are not a concern for the exercise; production is assumed to run on a paid plan with higher limits.
- Authentication and rate limiting of our own API are out of scope, to be discussed separately.

## Location input: geocoding vs. ranking

**Question (for the team):** The brief says the service "takes a city or town". Should the ranking accept a city name and geocode internally, or accept coordinates, with location search as a separate step?

**Assumption:**

- Two steps: location search is separate from ranking, and the ranking takes coordinates only.
- To be revisited with the team; no one to ask here, so this is the working assumption.

**Why:**

- Coordinates keep the ranking independent of where the location came from. Any consumer can supply it, e.g. a frontend map picker that only has coordinates.
- A city name plus country does not identify a place. One country can have many settlements with the same name, so it is unclear which one to return.
- Mixing location lookup and weather ranking in one function gives the service two responsibilities; two steps keep them separate and easier to maintain.

**Decision:** For this exercise, location search is a separate module within the same service, so it can easily be split out later if needed.

- The modules are loosely coupled: no foreign keys between place search and weather tables, and no code imports of each other's models. Each module can later become its own service with its own database.

## Storage

**Decision:**

- PostgreSQL is the only store. No Redis: Postgres handles the expected load, and persisted data is what the brief asks for. There is no shared counter for Open-Meteo limits either: if Open-Meteo returns an error and there is no stored data, the request fails with an error.
- Concurrent refreshes of the same location are deduplicated with an in-memory map of in-flight fetches inside one instance. A race between instances is accepted: it costs at most one extra stored row, because writes are append-only.
- Each fetch always requests 8 days from today, regardless of the requested range, so there is one stored state per location rather than one per range. This costs the same: Open-Meteo counts a request as one call up to 10 weather variables and 2 weeks.
- Raw hourly data from Open-Meteo is stored as received, after validation. Scoring features (daily aggregates) are derived from it at read time, so changing the scoring needs no data migration.
- No spatial database or PostGIS. Coordinates are rounded to 2 decimals (about 1.1 km) before calling Open-Meteo, and the rounded pair is a unique key.
- Every fetched state is stored with its fetch time, and reads always take the latest one. Retention of old states is still to be decided.
- Results of location search are stored in Postgres too, so repeated searches are fast and do not hit the geocoding API every time.
- Data is fetched on demand: when a request needs data that is older than its refresh interval, it is fetched then.

## Errors and stale data

**Decision:**

- When fresh data cannot be fetched, stale data is returned together with the time it was actually fetched, per source. The client decides what to show the user.
- Stale data older than 48 hours is not returned; the request fails instead.
- This applies per activity: if the wave data is too old, only surfing fails, and skiing, outdoor and indoor sightseeing are still returned.
- When Open-Meteo rate limits are hit, the response carries the time of the last fetch, and a dedicated error is raised only when there is no stored data at all.

**Why:** In our measurements a cached forecast changes noticeably with age. With a 24-hour-old cache the score changes by about 0.05 for tomorrow, and with a 48-hour-old cache by up to 0.12 for skiing three days ahead. 48 hours was chosen as a single limit for all sources.

## Stack and tooling

**Decision:**

- TypeScript, NestJS, GraphQL, class-validator for request validation, zod for validating Open-Meteo responses.
- Prisma with PostgreSQL for storage and migrations.
- GraphQL contracts are written by hand and are not generated from Prisma models, because they are shared across services.
- Requests to Open-Meteo are retried once. The timeout and retry settings are environment variables.
- Each activity is implemented behind one common interface, so a new activity can be added without touching the others.
- A health endpoint reports the state of our own service; it does not call Open-Meteo.
- Observability with OpenTelemetry and grafana/otel-lgtm, started only behind a flag (a compose profile), so the default run does not need it.
- Dockerfiles for everything and one docker compose to run it all locally.
- Unit tests cover everything; e2e tests use the NestJS testing tools with a mocked Open-Meteo API, so they never call the real one.

## Licence

- Open-Meteo data is licensed CC BY 4.0, so attribution has to be stated in the README.

## Out of scope

- Authentication and rate limiting of our own API.
- Cleaning up the stored fetch history. At the expected scale it takes little space in Postgres, and data is fetched on demand, so it can be solved later as a separate task.
- The draft contract is in `docs/graphql-schema.graphql`. It exposes no internal details of the service.
