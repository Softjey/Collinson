# T07 Documentation and submission

| | |
|---|---|
| Depends on | T06 |
| Unblocks | none |
| Wave | 5 |

## Goal

The repository is ready to hand in: a short README, documents that match what was built, and the trail of how
the work was done.

References: the brief ("What to submit"); [technical spec](../technical-spec.md) sections 1 and 12.

## Scope

- **README**: what was built; how to run it (compose, the observability profile, the three test commands);
  two example queries with example responses; the assumptions; what was cut and why; Open-Meteo attribution
  (CC BY 4.0).
- **DECISIONS.md**: every decision confirmed during implementation, every cut with its reason, and the
  assumptions to check with the team. Only what the owner confirmed.
- **Technical spec**: close the open items of section 12 with what was chosen; update the contract summary
  (`NO_DATA`, nullable `elevation`) and the contract location; remove the "draft" notes that no longer apply.
- **Implementation plan**: mark each ticket as done, cut or changed, with one line on any deviation.
- **AI sessions**: export the sessions into `ai-sessions/` as Markdown, translated into English.
- Final pass: a clean clone, `docker compose up`, the README queries, and the full test suite.

## Checks

- Every command in the README was run from a clean clone and works as written.
- No link in the documents points to a file that was moved or removed.
- The contract file, the README examples and the running service agree.

## Done when

- The repository is public and a reviewer can run the service and follow the reasoning from the documents
  alone.

## Out of scope

New features, refactoring.
