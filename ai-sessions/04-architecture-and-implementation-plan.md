# Session 04: architecture and implementation plan

Started 2026-10-13 10:51 UTC.

## User

Hi, we need to put together a clear architecture and implementation plan for the whole backend. Go through everything in this repo, and if something is unclear, ask me questions. If everything is clear, think it all through in detail and write a clear architecture and an implementation plan broken down by tickets.

> `Bash` List repository files and their sizes: `git ls-files && echo --- && ls -la && wc -l $(git ls-files)`
> `Read` TASK.md
> `Read` DECISIONS.md
> `Read` docs/technical-spec.md
> `Read` docs/graphql-schema.graphql
> `Read` prisma/schema.prisma
> `Bash` Show small repo files and local tool versions: `cat README.md .gitignore; ls -la .vscode ai-sessions docs; cat .vscode/* 2>/dev/null | head -50; node -v; npm -v; pnpm -v 2>/dev/null; docker -v 2>/dev/null`
> `Bash` Verify Open-Meteo behaviours and check current npm package versions: `cd <tmp> 2>/dev/null || mkdir -p /private ...`
> `AskUserQuestion`
>   - **A snapshot always covers 8 days from the day it was loaded. After local midnight, a "fresh" snapshot (weather up to 6 h, waves up to 24 h) no longer contains day today+7, although validation allows it. How should we handle this?**
>     - Refetch if it does not cover (Recommended): A snapshot is usable only if it is within the interval AND covers the requested range. Otherwise we fetch. If the fetch failed and the old snapshot is used, days without data are returned separately (see the next question).
>     - Refetch on day change: A snapshot loaded on the previous local day is always considered stale, regardless of the requested range. A simpler rule, but more Open-Meteo calls.
>     - Do not refetch: The rule stays age-only (6/24 h). Days missing from the snapshot are returned as days without data.
>   - **In the contract a day can only be ScoredDay or UnscoredDay (NO_SEA / NO_SNOW). How should we return a day for which the stored snapshot has no hours or all values are null?**
>     - UnscoredReason NO_DATA (Recommended): Add a third reason to the UnscoredReason enum. The other days of the activity are returned as usual, and the contract stays without nullables.
>     - Whole activity unavailable: If at least one requested day has no data, the activity returns ActivityDataUnavailable (TEMPORARILY_UNAVAILABLE). The contract does not change, but the days we do have are lost.
>     - Skip the day: The days list simply does not contain that day. The contract does not change, but the client cannot tell this from an error.
>   - **ScoredLocation.elevation is currently Float! and is taken from the weather snapshot. If there is no weather at all (first request, Open-Meteo is down), there is no elevation, and all activities will be ActivityDataUnavailable. What should we do with location?**
>     - elevation nullable (Recommended): elevation: Float (null until there is any weather snapshot). latitude/longitude are the coordinates rounded to 2 decimals, timezone comes from an offline library, so they are always there.
>     - Remove elevation: ScoredLocation contains only latitude, longitude, timezone. No nullable, but the client does not see the elevation of the point (useful for skiing).
>     - Error for the whole request: If there is no weather at all, the request returns a GraphQL error instead of ActivityDataUnavailable for each activity. elevation stays non-null.
>   - **Which GraphQL approach in NestJS and which driver?**
>     - Schema-first + Apollo (Recommended): docs/graphql-schema.graphql moves into src and becomes the single source of truth. Resolvers and DTOs with class-validator are written to match it. Closest to "a contract written by hand".
>     - Code-first + Apollo: The contract is described with decorators on classes (the same classes carry class-validator). The SDL is generated and checked by a test against the committed contract file.
>     - Schema-first + Mercurius: Same as the first option, but on Fastify/Mercurius. Faster, but less standard and pulls in the Fastify platform.

> **Answer:** The user answered: "A snapshot always covers 8 days from the day it was loaded. After local midnight, a "fresh" snapshot (weather up to 6 h, waves up to 24 h) no longer contains day today+7, although validation allows it. How should we handle this?"="Refetch if it does not cover (Recommended)", "In the contract a day can only be ScoredDay or UnscoredDay (NO_SEA / NO_SNOW). How should we return a day for which the stored snapshot has no hours or all values are null?"="UnscoredReason NO_DATA (Recommended)", "ScoredLocation.elevation is currently Float! and is taken from the weather snapshot. If there is no weather at all (first request, Open-Meteo is down), there is no elevation, and all activities will be ActivityDataUnavailable. What should we do with location?"="Explain in more detail: so location is built from the weather request, and what happens if the first request fails?", "Which GraphQL approach in NestJS and which driver?"="I think schema first, and we will store it separately as a fixed contract for communication". Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say.

> `AskUserQuestion`
>   - **What should we do with ScoredLocation.elevation if there is no weather snapshot for the point yet and the first request to Open-Meteo failed?**
>     - elevation nullable (Recommended): elevation: Float. Null only while the point has no weather snapshot. After the first successful fetch the elevation is stored in Location and always returned, even when the data is stale.
>     - Remove elevation: ScoredLocation contains only latitude, longitude, timezone. No nullable, but the client does not see the elevation of the grid point (useful for understanding the skiing score).
>     - Error for the whole request: If there is no weather at all, activityScores returns a GraphQL error instead of ActivityDataUnavailable for each activity. elevation stays Float!.
>   - **Schema-first is fixed. Where does the contract file live and which driver?**
>     - One file in docs + Apollo (Recommended): docs/graphql-schema.graphql stays the single file: both the fixed contract for communication and what the service loads as typePaths. It cannot diverge from the implementation. Driver is Apollo Server 5.
>     - Copy in src + test + Apollo: The contract in docs/ is untouched, the service has its own SDL in src/, and a test checks that they are identical. Two files, but the contract is physically separate from the code.
>     - One file in docs + Mercurius: Like the first option, but on Fastify/Mercurius instead of Apollo.
>   - **How do the e2e tests get PostgreSQL?**
>     - Testcontainers (Recommended): The tests start a disposable Postgres container themselves, run the migrations and clean up after themselves. One command to run, only Docker is needed.
>     - Service in docker compose: A separate postgres-test service in compose (or a separate database in the same Postgres). It must be started before running e2e, but there is no extra dependency.
>   - **How long does the place search result cache (PlaceSearch) live?**
>     - 30 days (Recommended): After 30 days the search goes to the geocoder again and the record is refreshed. If the geocoder is unavailable, the old result is returned. The value is in env.
>     - Indefinitely: A stored search is never refreshed. Simplest, but new or renamed places will not appear.
>     - 7 days: Same as 30 days, but refreshed more often. The value is in env.

> **Answer:** The user answered: "What should we do with ScoredLocation.elevation if there is no weather snapshot for the point yet and the first request to Open-Meteo failed?"="elevation nullable (Recommended)", "Schema-first is fixed. Where does the contract file live and which driver?"="docs is a draft, I would like a separate folder for contracts", "How do the e2e tests get PostgreSQL?"="Testcontainers (Recommended)", "How long does the place search result cache (PlaceSearch) live?"="30 days (Recommended)". Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say.

> `Write` docs/implementation-plan.md
> `Edit` DECISIONS.md
> `Edit` DECISIONS.md
> `Edit` DECISIONS.md

## Claude

The plan is ready: [docs/implementation-plan.md](docs/implementation-plan.md). I also added the six decisions you confirmed to [DECISIONS.md](DECISIONS.md). Nothing is committed.

## What is in the plan

- **Architecture:** `search` and `weather` do not know about each other, `scoring` is pure with no I/O, and `activity-scores` is the only module that connects them. It has the folder structure, key interfaces, the snapshot freshness policy and the request flow.
- **20 tickets** in build order with a dependency graph. For each one, it describes the tests that are written first (positive and negative) and what gets implemented.
- **Scoring (T05-T08)** depends only on the scaffold, so it can be done earlier or in parallel with the data path (T09-T12).
- **Checked against the live API:** `timeformat=unixtime` works, forecast and waves return 192 hours, Marine for Madrid returns only `null`. Current package versions from npm are recorded in the plan.

## What I need from you

Section 2 of the plan has 15 proposals (P1-P15) that the tickets already rely on but that you have not confirmed yet, so they are not in DECISIONS.md. The most important ones:

- **P1, P2:** Apollo Server 5; the contract at `contracts/graphql/schema.graphql`, and the service loads exactly this file. You said "a separate folder for contracts", but I chose the folder name and the driver myself.
- **P3, P4:** pnpm, Jest, `@photostructure/tz-lookup` for offline timezone lookup.
- **P7:** if for surfing one source is unavailable and the other is stale, `ActivityDataUnavailable` is returned. For a city without a sea, with weather unavailable, surfing will also be `Unavailable`, not `NO_SEA`.
- **P9:** the score is rounded to 2 decimals, and the category is taken from the rounded value.
- **P12:** if the geocoder is down and there is nothing in the cache, `searchLocations` returns a GraphQL error, because the contract has no type for this.

The rest covers env variable names, retry policy, validation rules and `parserVersion`.

## Risks

- **Toolchain:** NestJS 12, Prisma 7, TypeScript 7 and Jest 30 are very new and may not work together. So T01 and T03 first prove that it works and pin the exact versions.
- **Scoring fixtures:** the spec has no humidity for the historical events (Eunice, Saola, Beaver Creek), so in T06 and T07 the values will have to be re-read once from the Open-Meteo archive.

Tell me which of P1-P15 you confirm or change, and I will update the plan and DECISIONS.md.

## User

Reduce the number of tickets, put each of them in a separate document. Give them topologically sorted so that the ones that can be done in parallel can be done in parallel.

> `Bash` Replace the ticket section of the plan with an index and parallel waves: `mkdir -p docs/tickets && python3 - <<'EOF' import re,io p='docs/implementation-plan.md' s=open(p).read() a=s.index('## 4. Tickets'); b=s.index('## 5. Risks') ne ...`
> `Write` docs/tickets/T01-foundation.md
> `Write` docs/tickets/T02-scoring.md
> `Write` docs/tickets/T03-weather-data.md
> `Write` docs/tickets/T04-location-search.md
> `Write` docs/tickets/T05-activity-scores.md
> `Write` docs/tickets/T06-containers-observability.md
> `Write` docs/tickets/T07-docs-submission.md

## Claude

There are now 7 tickets instead of 20, each in a separate document in [docs/tickets/](docs/tickets/), and section 4 of [implementation-plan.md](docs/implementation-plan.md) became an index with waves. Nothing is committed.

## Topological order

```
Wave 1        Wave 2                Wave 3      Wave 4      Wave 5

              T02 scoring ------+
T01 --------> T03 weather data -+-> T05 ------> T06 ------> T07
foundation    T04 search ---------------------^
```

| Wave | Tickets | In parallel |
|---|---|---|
| 1 | [T01 Foundation](docs/tickets/T01-foundation.md) | no, everything depends on it |
| 2 | [T02 Scoring](docs/tickets/T02-scoring.md), [T03 Weather data](docs/tickets/T03-weather-data.md), [T04 Location search](docs/tickets/T04-location-search.md) | yes, all three |
| 3 | [T05 activityScores](docs/tickets/T05-activity-scores.md) | T04 can still be running alongside |
| 4 | [T06 Containers and observability](docs/tickets/T06-containers-observability.md) | no |
| 5 | [T07 Documentation and submission](docs/tickets/T07-docs-submission.md) | no, it describes the final state |

Critical path: T01 → T03 → T05 → T06 → T07.

## Why wave 2 does not conflict

So that the three tickets can really be done at the same time, T01 takes on everything shared:

- **Module shells:** empty `scoring`, `weather`, `search`, `activity-scores` already registered in `app.module.ts`, with stub resolvers for both queries.
- **DB schema and contract:** the whole Prisma schema, the first migration and the contract file are finalised in T01, so no migrations or contract changes are needed later.
- **Open-Meteo HTTP client:** it is shared by weather and the geocoder, so it is also in T01, and T03 and T04 do not wait for each other.

After that, T02 touches only `src/scoring`, T03 only `src/weather`, T04 only `src/search`.

The cost of this split: T01 became the largest ticket (scaffold, config, DB, contract, HTTP client, health). If you want, it can be cut into two, but then wave 1 becomes a sequence of two steps.

## What stays open

Proposals P1-P15 from section 2 of the plan are still not confirmed, and the tickets rely on them. Before starting T01 we need at least P1-P5: the Apollo driver, the path `contracts/graphql/schema.graphql`, pnpm and Jest, the timezone library, the env variable names.

## User

Good, commit my changes

> `Bash` Show working tree changes: `git status --short && git diff --stat`
> `Bash` Commit the plan, tickets and decisions: `git add DECISIONS.md docs/implementation-plan.md docs/tickets && git commit -q -m "docs: add implementation plan and tickets Add the architecture and implementa ...`

## Claude

Committed to `main` as `b780705` (`docs: add implementation plan and tickets`): the plan, 7 tickets in [docs/tickets/](docs/tickets/) and the updated [DECISIONS.md](DECISIONS.md). The working tree is clean, I did not push.

## User

Also add to agents.md that when working on tickets, commits should be made independently, step by step

> `Edit` AGENTS.md
> `Bash` Commit the AGENTS.md update: `git add AGENTS.md && git commit -q -m "docs: require step-by-step commits while working on tickets Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && g ...`

## Claude

I added a rule to the Conventions section of [AGENTS.md](AGENTS.md#L15-L16): while working on a ticket, the agent commits on its own, step by step, as soon as a step is finished, without waiting to be asked and without saving everything for one commit at the end.

I committed it as `a0085f0`, because the rule relates exactly to this; I did not push.
