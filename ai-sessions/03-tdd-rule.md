# Session 03: tdd rule

Started 2026-10-13 10:47 UTC.

## User

Hi, the work here will follow TDD, so update agents so it says that before implementing a ticket, tests are written first. Also say that it is important to test both positive and negative cases (commit after that)

> `Edit` AGENTS.md
> `Bash` Commit the AGENTS.md update: `git add AGENTS.md && git commit -q -m "docs: require TDD and positive/negative test coverage Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log ...`

## Claude

Done. I added a `Testing` section to [AGENTS.md](AGENTS.md) and committed it to `main` (`f862a60`):

- Work follows TDD: before implementing a ticket, the tests are written first, then the implementation that makes them pass.
- Cover both positive and negative cases.
