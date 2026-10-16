# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Backend service (Node.js + GraphQL) that ranks the next 7 days for skiing, surfing, outdoor sightseeing and indoor sightseeing in a given city, using persisted Open-Meteo data. The brief is in `TASK.md`, kept locally and not committed.

## Conventions

- Everything in the repo (code, docs, comments, commits) is written in English.
- Commit messages follow Conventional Commits.
- Commit directly to `main`. Do not create feature branches.
- When working on a ticket, commit on your own, step by step, as each step is finished. Do not wait to be asked
  and do not save everything for one commit at the end.
- Keep comments in code to a minimum. Do not comment what the code already says; add a comment only to explain a non-obvious reason. Prefer clear names over comments.
- Before pushing, run lint, the type check and the tests you touched, and read the result. A shell chain that ends in
  `grep` or `tail` hides failures, so do not chain a push after it.

## Code style

The goal: someone who knows nothing about the system can read the code, not the comments, and understand it.

- Names are full and descriptive, never shortened: `placeRepository`, not `places`; `PlaceSearchService`, not
  `SearchService`. Injected fields are named after their type. Put units into names of measurements
  (`maxWindSpeedKmh`). Do not hardcode string lists or magic values in place: declare them once as typed constants
  and derive types and schemas from them.
- Prefer small classes with clear responsibilities over loose functions. Prefer declaring things (a table, a list of
  rules) over branching code, so adding a case means adding a declaration.
- Fewer files and layers where a layer adds nothing. Remove avoidable mapping by using the same name and type for the
  same thing in every layer. Keep what remains as explicit mapper classes.
- Do not repeat yourself. Shared decorators, utilities and constants go to `shared/`; write them once.
- Raw SQL only as Prisma TypedSQL (`prisma/sql/*.sql`). Do not await in a loop when one batched statement will do.
- Fix the same kind of problem everywhere it occurs, not only where it was pointed out.

## Module structure

- A module exports only its service, and only if another module needs it. Modules do not import each other's internals;
  only `activity-scores` knows both `weather` and `scoring`.
- Module root: the module, service, resolver and clients. Other folders: `entities/` (types only, no logic),
  `mappers/` (translation classes, used only by the service), `repositories/` (Prisma access, returns rows without
  mapping), `utils/` (pure production helpers), `specs/` next to the code under test.
- An upstream response is validated inside `shared/open-meteo`, which also owns the request parameters. Other modules
  get typed, validated data.

## Testing

- Work follows TDD: before implementing a ticket, write the tests first, then write the implementation that makes them pass.
- Cover both positive and negative cases.
- Test utilities live in `test/support/` (builders, suite hooks such as `useTestApp` and `useTestDatabase`, stubs, the
  fixture loader, shared GraphQL queries), never in `src/`. Look there before writing a helper, and move anything a
  second spec needs there instead of copying it.

## Decisions and assumptions

- Do not invent assumptions or decisions on your own, and do not record them in [DECISIONS.md](DECISIONS.md) until the user has confirmed them.
- When the brief is ambiguous or a decision is needed, ask the user via AskUserQuestion, offering your best guesses as options (recommended one first).
- Record only what the user decided, in their terms. Do not add extra rationale, constants or details they did not state.
- When a task is a large restructure, say how you will organise it in a sentence or two and ask only about choices that
  are really the user's. For everything else take the conventional option and mention it in the summary.
- Keep the docs in `docs/` and the tickets in step with the code you change.
