# T01 Foundation

| | |
|---|---|
| Depends on | none |
| Unblocks | T02, T03, T04 |
| Wave | 1 |

## Goal

A running, tested skeleton that every later ticket only adds files to: toolchain, configuration, database,
the GraphQL contract served with stub resolvers, the shared Open-Meteo HTTP client and the health endpoint.
After this ticket T02, T03 and T04 can start in parallel without touching shared files.

References: [implementation plan](../implementation-plan.md) sections 2, 3.2, 3.6, 3.7;
[technical spec](../technical-spec.md) sections 4, 5, 10.

## Scope

### 1. Scaffold

- NestJS 12 project with pnpm, TypeScript strict, ESLint, Prettier, Jest with unit, integration and e2e configs.
- Scripts: `start:dev`, `build`, `lint`, `test`, `test:int`, `test:e2e`.
- `.env.example`; `.gitignore` additions: `node_modules`, `dist`, `.env`, `src/generated`.
- Empty module shells registered in `app.module.ts`: `scoring`, `weather`, `search`, `activity-scores`.
- Verify: the TypeScript version the Nest 12 CLI scaffolds works with decorator metadata and the Jest
  transformer. Pin exact versions of everything.

### 2. Configuration

- zod schema for the variables in plan section 3.6, a typed `AppConfig` provider, validation at start-up with a
  readable error.

### 3. Database

- Run `prisma validate` on the draft schema and fix what it reports.
- Prisma 7 setup: `prisma.config.ts`, generator output in `src/generated/prisma`, `@prisma/adapter-pg`, CLI
  pinned to 7.x, client generated in `postinstall`.
- First migration, covering every table of the draft (weather and search), so no later ticket needs one.
- `PrismaService` with connect and shutdown hooks.
- `docker-compose.yml` with Postgres only.
- Test support in `test/support/`: a Testcontainers helper that starts Postgres once per run, applies the
  migrations and truncates tables between tests.

### 4. Contract and GraphQL bootstrap

- Move `docs/graphql-schema.graphql` to `contracts/graphql/schema.graphql` and apply the confirmed changes:
  add `NO_DATA` to `UnscoredReason`; `ScoredLocation.elevation` becomes `Float`.
- Apollo schema-first module loading that file as `typePaths`.
- `Date` scalar (strict `YYYY-MM-DD`, rejects impossible dates) and `DateTime` scalar (UTC ISO 8601).
- Global `ValidationPipe`. Error formatter: validation errors get `extensions.code = BAD_USER_INPUT`,
  unexpected errors hide their internals.
- Stub resolvers for `searchLocations` and `activityScores` that throw "not implemented", placed in the
  `search` and `activity-scores` modules so the owning tickets replace them in place.

### 5. Open-Meteo HTTP client

- `OpenMeteoModule` in `src/shared/open-meteo/` exports only `OpenMeteoService` with `forecast`, `marine` and
  `geocoding`, each taking query parameters and returning the JSON body. The internal `OpenMeteoHttpClient`
  (one instance per endpoint, built on `@nestjs/axios`) is not exported.
- Typed errors: `OpenMeteoRateLimitedError` (429), `OpenMeteoBadRequestError` (other 4xx, keeps `reason`),
  `OpenMeteoUnavailableError` (network, timeout, 5xx, invalid JSON).
- Retry policy (P6): retry on network error, timeout and 5xx, up to `OPEN_METEO_RETRIES`; never on 4xx. The
  retry loop is the generic `retry` utility in `src/shared/retry.ts`.
- The API key is added as a query parameter only when configured. Verify how the paid plan expects it (P15).
- A scripted fake of `OpenMeteoService` in `test/support/` for e2e tests: it is the single seam replaced in e2e.

### 6. Health

- `GET /health` runs `SELECT 1`. It reports only this service and never calls Open-Meteo.

## Tests first

Unit:

- Config: defaults applied; numbers coerced; missing `DATABASE_URL` fails; non-numeric or negative durations
  fail; invalid URL fails.
- Scalars: valid values parse and serialise; `2026-02-30`, `2026-2-3`, a datetime passed as a date, and
  non-strings are rejected.
- Contract: the file parses; every `Query` field has a resolver.
- HTTP client: success returns parsed JSON; timeout is retried once then fails as unavailable; 5xx is retried
  once; a network error is retried; success on the retry returns the data; 429 is not retried and is
  rate-limited; 400 with `{error, reason}` is not retried and keeps the reason; retry count 0 disables
  retries; the key is absent when not configured and present when configured.

Integration (Testcontainers):

- Migrations apply to an empty database.
- `Location` rejects a duplicate `(latE2, lonE2)`.
- Deleting a snapshot cascades to its hours.

e2e:

- The application boots; introspection matches the contract file.
- A validation failure on input shape returns `BAD_USER_INPUT`.
- `/health` returns 200 with Postgres up and 503 with it down, and the fake Open-Meteo client records no call.

## Done when

- `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:int` and `pnpm test:e2e` pass on a clean checkout with
  only Docker running.
- The app refuses to start with an invalid environment.
- `docs/graphql-schema.graphql` no longer exists and the spec links point to the new location.

## Out of scope

Real resolvers, any scoring, any Open-Meteo endpoint-specific client, the application Dockerfile (T06).
