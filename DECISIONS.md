# Decisions

Running log of decisions, assumptions, open questions and things cut, each with a short reason.
Formulas, tables, data and the full design are in [docs/technical-spec.md](docs/technical-spec.md).

## Product

- **Per day, per activity.** Each activity is scored for each requested day and the API returns no rank, so the
  client sorts. Why: a traveller wants to know which day suits skiing and which day suits the city, and a weekly
  aggregate hides that.
- **Date range, not "next 7 days".** The API takes `fromDate` and `toDate` as dates (Open-Meteo daily data has
  no time component). `fromDate` is today or later, `fromDate <= toDate`, and `toDate` is at most 7 days after
  today, all in the location's time zone, which is determined offline from coordinates. Why: the client asks for
  what it needs, and the 8 fetched days match the 8 days of marine data.
- **Score 0 to 1 plus a category 1 to 8.** The categories are the 8 HCI classes for all activities, with the
  first two renamed to Unsuitable and Poor. No explanation of the score is returned. Why: one shared scale lets a
  client compare activities.
- **Impossible is not low.** Surfing without sea and skiing on a day without snow or snowfall are reported as
  unscored days, never as a low number. Outdoor and indoor sightseeing are always scored.
- **Any coordinates are supported.** "Regional" is about expected audience and load, not a restriction.

## Scoring

- **Based on published research and real Open-Meteo data**, not invented rules: Skiing Utility Index (skiing),
  HCI:Urban (outdoor). Surfing thresholds come from surf forecasting practice. Indoor is our own model:
  `0.5 + 0.5 * (1 - outdoor)`.
- **Thermal comfort uses humidex with mean humidity**, as in the authors' 2020 update of HCI, not effective
  temperature. Why: the effective temperature formula is not printed in the original paper, and it rates 42 C dry
  heat as 6 out of 10 while humidex rates it 0.
- **Surfing assumes a general or intermediate surfer**, with no skill parameter.
- **Additions made after validating on historical days:** outdoor is capped at 0.5 from 6 mm of daily
  precipitation and at 0.2 from 60 km/h maximum wind or 25 mm; skiing is multiplied by
  `min(1, snow depth / 0.3 m)` and by `(1 - rain / 3 mm)`. Why: plain HCI scored Storm Eunice in London at 0.63
  even though attractions were closed, and skiing scored early season days as high as mid-winter ones.
- **Known limits, refinement postponed to the end:** no wind direction for surfing, skiing in the off-season is
  not always unscored, caps were derived from the same events they were checked on.

## Data and storage

- **PostgreSQL only.** No Redis, no PostGIS. Why: the load is low and persisted data is what the brief asks for.
- **Coordinates rounded to 2 decimals (about 1.1 km)**, stored as integers with a unique key. Why: finer than the
  weather grid, coarse enough to remove GPS jitter, and fine in the mountains.
- **Raw hourly data in typed columns, no JSONB**, as snapshots with their fetch time. Features and scores are
  derived at read time. Why: changing the scoring needs no data migration.
- **Always fetch 8 days from today**, whatever range was requested. Why: one stored state per location, and one
  Open-Meteo call (up to 10 variables and 2 weeks).
- **Refresh on demand:** weather every 6 hours, waves every 24 hours. Why: the model updates every 6 hours, and
  waves change slowly.
- **Place search results are stored** so repeated searches do not call the geocoder.
- **Marine is queried with `cell_selection=sea`**, and no wave values means no sea. Why: the default returned
  nothing for coastal cities such as Barcelona, Sydney and Nice.
- **A stored snapshot that does not cover the requested dates is refetched**, even when it is within its
  refresh interval.
- **Place search results are kept for 30 days.**
- **Concurrency:** an in-memory map of in-flight fetches per instance. A race between instances is accepted
  because writes are append-only.

## Errors and stale data

- **Stale data is served with the time it was actually fetched**, per source, and the client decides what to show.
- **Data older than 48 hours is not served.** One limit for all sources. Why: in the measurements the score
  error for skiing roughly doubles between 24 and 48 hours on the nearest days.
- **Failures are per activity.** If waves fail only surfing fails.
- **A day the stored data does not cover is an unscored day with reason `NO_DATA`.**
- **`ScoredLocation.elevation` is nullable**: there is no elevation when the first weather request for a point
  fails.
- **No limit counter.** If Open-Meteo fails or limits requests and there is no stored data, the activity gets an
  error. Production is assumed to use a paid plan.
- **Requests to Open-Meteo are retried once**, with timeout and retries in environment variables.

## Architecture and stack

- **Two steps, loosely coupled modules.** Location search is separate from ranking, which takes coordinates
  only. The modules share no foreign keys and no model imports, so each can become its own service with its own
  database. Why: a name does not identify a place, and any consumer can supply coordinates.
- **Open-Meteo is assumed to be a stable service that will not change.** This was not discussed with the team
  beforehand. The code is not designed so that Open-Meteo can be easily replaced. It is designed for the easiest
  maintenance of all the code and for fewer abstractions.
- **TypeScript, NestJS, GraphQL, class-validator, zod** for upstream responses, **Prisma** with PostgreSQL.
- **Schema-first GraphQL.** The contract is kept in its own folder as the fixed contract for communication; the
  file in `docs/` is a draft.
- **e2e tests get PostgreSQL from Testcontainers.**
- **The GraphQL contract is written by hand**, not generated from the models, and exposes no internals.
  Nullable fields are avoided so invalid combinations cannot be expressed.
- **Activities share one interface**, so adding an activity does not touch the others.
- **Health reports only our own service.** Observability with OpenTelemetry and grafana/otel-lgtm behind a
  flag. Dockerfiles and one docker compose.
- **Tests:** unit tests for everything, e2e with the NestJS tools and a mocked Open-Meteo.

## Assumptions to check with the team

- Load is low, the audience is small, availability and latency targets were not discussed.
- Ranking takes coordinates only, with location search as a separate step.
- The 48 hour limit and the 6 and 24 hour refresh intervals have no stated requirement behind them.

## Out of scope and cut

- Authentication and rate limiting of our own API: a layer on top of the solution, to be discussed separately.
- Cleaning up stored snapshots: little data at this scale, and fetching is on demand.
- Background refresh job, Redis, a shared limit counter, cross-instance locking: not worth it at this scale.
- Wind direction and skill levels for surfing, resort-level data for skiing.

## Licence

Open-Meteo data is CC BY 4.0, so attribution is stated in the README.
