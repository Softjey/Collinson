# Activity Weather Ranking Service

A GraphQL backend that scores how good each of the next days will be for skiing, surfing, outdoor sightseeing
and indoor sightseeing at a given place, using Open-Meteo forecasts that are stored in PostgreSQL and refreshed
on demand.

## What was built

- **Two queries.** `searchLocations` finds places by name and returns coordinates. `activityScores` takes
  coordinates and a date range (today up to 7 days ahead, in the place's time zone) and returns, for every
  requested activity and every day, a score from 0 to 1 and one of 8 categories, or the reason the day cannot be
  scored (`NO_SEA`, `NO_SNOW`, `NO_DATA`). The API does not rank; clients sort by score.
- **Scoring** is based on published research checked against historical Open-Meteo data: the Skiing Utility
  Index for skiing, HCI:Urban for outdoor sightseeing, surf forecasting thresholds for surfing, and the opposite
  of outdoor for indoor sightseeing. The formulas and the validation are in the
  [technical spec](docs/technical-spec.md), sections 8 and 9.
- **Storage and refresh.** Raw hourly forecast and marine data is stored as snapshots. Weather is refetched after
  6 hours and waves after 24 hours, on request. If Open-Meteo fails, data up to 48 hours old is served with the
  time it was fetched; a failure affects only the activities that need that data.
- **Stack:** TypeScript, NestJS, Apollo GraphQL (schema-first, contract in
  [contracts/graphql/schema.graphql](contracts/graphql/schema.graphql)), Prisma with PostgreSQL, zod,
  class-validator, OpenTelemetry behind a flag, Jest with Testcontainers.

How the work was done: [DECISIONS.md](DECISIONS.md) (decisions, assumptions, cuts),
[docs/](docs/) (technical spec, implementation plan, tickets) and [ai-sessions/](ai-sessions/) (the AI sessions).

## Running

Requires Docker.

```sh
docker compose up --build
```

The GraphQL endpoint is <http://localhost:3000/graphql> and the health check is <http://localhost:3000/health>.
If ports 3000 or 5432 are taken, set `APP_PORT` and `POSTGRES_PORT`, for example
`APP_PORT=3010 POSTGRES_PORT=5439 docker compose up --build`.

With traces, metrics and logs in Grafana (<http://localhost:3001>, user `admin`, password `admin`):

```sh
OTEL_ENABLED=true docker compose --profile observability up --build
```

## Tests

Requires Node.js 22 or later, pnpm and Docker (Prisma TypedSQL and the integration and e2e tests start
PostgreSQL with Testcontainers). No test calls the real Open-Meteo.

```sh
pnpm install
pnpm test          # unit
pnpm test:int      # repositories against PostgreSQL
pnpm test:e2e      # GraphQL over HTTP through the whole application
```

## Example queries

Send them as a POST to `/graphql`. `fromDate` must be today or later and `toDate` at most 7 days after today,
so change the dates below to current ones.

Find a place:

```graphql
query {
  searchLocations(name: "Barcelona", count: 2) {
    id name country countryCode admin1 latitude longitude elevation timezone population
  }
}
```

```json
{
  "data": {
    "searchLocations": [
      { "id": "3128760", "name": "Barcelona", "country": "Spain", "countryCode": "ES", "admin1": "Catalonia",
        "latitude": 41.38879, "longitude": 2.15899, "elevation": 15, "timezone": "Europe/Madrid", "population": 1686208 },
      { "id": "3648559", "name": "Barcelona", "country": "Venezuela", "countryCode": "VE", "admin1": "Anzoátegui",
        "latitude": 10.1384, "longitude": -64.68769, "elevation": 3, "timezone": "America/Caracas", "population": 815141 }
    ]
  }
}
```

Score days at its coordinates:

```graphql
query {
  activityScores(input: {
    latitude: 41.39, longitude: 2.16, fromDate: "2026-10-17", toDate: "2026-10-19"
    activities: [SURFING, OUTDOOR_SIGHTSEEING, SKIING]
  }) {
    location { latitude longitude elevation timezone }
    activities {
      __typename
      ... on ActivityDayScores {
        activity
        days {
          ... on ScoredDay { date score categoryIndex category }
          ... on UnscoredDay { date reason }
        }
        freshness { kind updatedAt stale }
      }
      ... on ActivityDataTooOld { activity lastUpdatedAt }
      ... on ActivityDataUnavailable { activity cause }
    }
  }
}
```

```json
{
  "data": {
    "activityScores": {
      "location": { "latitude": 41.39, "longitude": 2.16, "elevation": 45, "timezone": "Europe/Madrid" },
      "activities": [
        {
          "__typename": "ActivityDayScores",
          "activity": "SURFING",
          "days": [
            { "date": "2026-10-17", "score": 0, "categoryIndex": 1, "category": "UNSUITABLE" },
            { "date": "2026-10-18", "score": 0.39, "categoryIndex": 2, "category": "POOR" },
            { "date": "2026-10-19", "score": 0, "categoryIndex": 1, "category": "UNSUITABLE" }
          ],
          "freshness": [
            { "kind": "WEATHER", "updatedAt": "2026-10-16T10:38:50.166Z", "stale": false },
            { "kind": "WAVES", "updatedAt": "2026-10-16T10:38:46.953Z", "stale": false }
          ]
        },
        {
          "__typename": "ActivityDayScores",
          "activity": "OUTDOOR_SIGHTSEEING",
          "days": [
            { "date": "2026-10-17", "score": 0.63, "categoryIndex": 5, "category": "GOOD" },
            { "date": "2026-10-18", "score": 0.5, "categoryIndex": 4, "category": "ACCEPTABLE" },
            { "date": "2026-10-19", "score": 0.5, "categoryIndex": 4, "category": "ACCEPTABLE" }
          ],
          "freshness": [{ "kind": "WEATHER", "updatedAt": "2026-10-16T10:38:50.166Z", "stale": false }]
        },
        {
          "__typename": "ActivityDayScores",
          "activity": "SKIING",
          "days": [
            { "date": "2026-10-17", "reason": "NO_SNOW" },
            { "date": "2026-10-18", "reason": "NO_SNOW" },
            { "date": "2026-10-19", "reason": "NO_SNOW" }
          ],
          "freshness": [{ "kind": "WEATHER", "updatedAt": "2026-10-16T10:38:50.166Z", "stale": false }]
        }
      ]
    }
  }
}
```

## Assumptions

Questions that would normally go to a product manager, with the assumption taken. The full list is in
[DECISIONS.md](DECISIONS.md#assumptions-to-check-with-the-team).

- Load is low and the audience is small; no availability or latency targets were set.
- Ranking takes coordinates only, with place search as a separate step, because a name does not identify a place.
- A traveller wants to compare days, so each day and activity is scored separately rather than as a weekly total.
- Open-Meteo is a stable service, so the code is not built to swap it out.
- The 6 and 24 hour refresh intervals and the 48 hour limit for stale data have no stated requirement behind
  them.

## Cut and why

- Authentication and rate limiting of our own API: a layer on top, to be discussed separately.
- Cleaning up old snapshots: little data at this scale.
- A background refresh job, Redis, a shared Open-Meteo limit counter and cross-instance locking: not worth it at
  this scale; data is fetched on demand and writes are append-only.
- Wind direction and skill levels for surfing, resort-level data for skiing.
- Grafana dashboards are not provisioned; traces, metrics and logs are explored in Grafana Explore.

## Known limitations

- **Scores are for the weather grid cell, not for a resort or a beach.** Pass the coordinates of the slope or the
  beach, not of the town. Zermatt (1608 m) has no snow in October, while Klein Matterhorn (3747 m) has good
  skiing. `ScoredLocation.elevation` in the response shows the elevation the score was calculated for.
- **Waves come from the nearest sea cell**, which can be 5 to 10 km from the requested point, not from a
  specific beach.
- **Scoring limits:** surfing ignores wind direction, skiing at high grid cells is scored in the off-season
  because snow is present, and the outdoor caps were derived from the same events they were checked on.

## Attribution

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
