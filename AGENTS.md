# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Backend service (Node.js + GraphQL) that ranks the next 7 days for skiing, surfing, outdoor sightseeing and indoor sightseeing in a given city, using persisted Open-Meteo data. See [TASK.md](TASK.md) for the brief.

## Conventions

- Everything in the repo (code, docs, comments, commits) is written in English.
- Commit messages follow Conventional Commits.
- Commit directly to `main`. Do not create feature branches.
- When working on a ticket, commit on your own, step by step, as each step is finished. Do not wait to be asked
  and do not save everything for one commit at the end.
- Keep comments in code to a minimum. Do not comment what the code already says; add a comment only to explain a non-obvious reason. Prefer clear names over comments.

## Testing

- Work follows TDD: before implementing a ticket, write the tests first, then write the implementation that makes them pass.
- Cover both positive and negative cases.

## Decisions and assumptions

- Do not invent assumptions or decisions on your own, and do not record them in [DECISIONS.md](DECISIONS.md) until the user has confirmed them.
- When the brief is ambiguous or a decision is needed, ask the user via AskUserQuestion, offering your best guesses as options (recommended one first).
- Record only what the user decided, in their terms. Do not add extra rationale, constants or details they did not state.
