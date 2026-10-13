# T06 Containers and observability

| | |
|---|---|
| Depends on | T04, T05 |
| Unblocks | T07 |
| Wave | 4 |

## Goal

One command runs the service locally, and an optional profile adds traces, metrics and logs.

References: [technical spec](../technical-spec.md) section 10;
[implementation plan](../implementation-plan.md) section 3.6.

The two parts are independent. Observability is the first thing to cut if time runs out; the cut is then
recorded in DECISIONS.md with the reason.

## Scope

### 1. Containers

- Multi-stage `Dockerfile`: install and build (including `prisma generate`), then a slim runtime image running
  as a non-root user.
- `docker-compose.yml`: Postgres (from T01) plus the app. Migrations are applied with `prisma migrate deploy`
  before the app starts. The app waits for a healthy Postgres and has its own health check on `/health`.
- `.dockerignore`.

### 2. Observability, behind `OTEL_ENABLED`

- `tracing.ts`, loaded before the application when the flag is on: spans for incoming HTTP and GraphQL
  requests and for outgoing Open-Meteo calls.
- `metrics.ts`: counters for snapshot reuse, refresh, refresh failure and stale response, labelled by source.
  They are recorded through a small interface so `weather` does not import the OpenTelemetry SDK.
- Structured JSON logs with the trace id when tracing is on.
- Compose profile `observability` running `grafana/otel-lgtm`. The default `docker compose up` starts only the
  app and Postgres.

## Tests first

- With `OTEL_ENABLED=false` no SDK is started and the metrics interface is a no-op.
- With an in-memory metric reader: a reused snapshot increments reuse; a successful fetch increments refresh;
  a failed fetch increments refresh failure; a stale fallback increments stale response; labels carry the
  source.
- The existing e2e suite still passes with the flag on and no collector reachable (export failures must not
  break requests).

Manual checks (the only ones against the live Open-Meteo):

- `docker compose up` on a clean checkout, then one `searchLocations` and one `activityScores` query succeed.
- `docker compose --profile observability up`, then a trace of an `activityScores` request with its Open-Meteo
  child spans is visible in Grafana.

## Done when

- Both manual checks pass and their commands are ready to paste into the README (T07).

## Out of scope

Dashboards, alerting, production deployment, CI.
