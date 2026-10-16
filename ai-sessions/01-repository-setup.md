# Session 01: repository setup

Started 2026-10-12 08:40 UTC.

## User

Hi, research the task that needs to be done and how to present this work

## Claude

I'll look at what is in the project folder.

> `Bash` : `ls -la`
> `Read` lead-snr-engineer-test-062026.pdf
> `Bash` : `ls -la .vscode && cat .vscode/* | head -50`

## Claude

I'll try to extract the text another way.

> `Bash` : `(which pdftotext mutool qpdf; python3 -I -c "import pypdf" 2>&1; python3 -I -c "import fitz" 2>&1; mdls -name kMDItemTextContent lead-snr-engineer-test-062026.p ...`
> `Bash` : `cd <tmp> && cat > ext.swift <<'EOF' impor ...`

## Claude

## Task (Senior/Lead Engineer take-home)

**What to build:** a backend service (Node.js + GraphQL) that takes a city/locality and ranks how good the next 7 days will be for these activities:
- Skiing
- Surfing
- Outdoor sightseeing
- Indoor sightseeing

**Key requirements:**
- Weather data comes from **Open-Meteo**.
- The data must be **persisted**, not fetched from the API on every request. How to model, store and refresh it is part of the task.
- The storage is your choice.
- **No frontend.**
- Quality over volume: a focused solution is better than an exhaustive one.
- Using AI is allowed and encouraged (any model, free tier is fine).
- The task is deliberately vague: wherever you would ask a PM, write down the question and the assumption you made.

## How to present it

A public GitHub repository. Two things, **in this order of importance**:

1. **How you worked** (most important). Show the thought process, not a final essay: a plan up front, an AI session export, notes, commits, anything. Do not over-polish. If you cut something or did not have time, one line of "why" is worth more than the thing itself.
2. **The service + a short README:** what was done, how to run it, assumptions.

When finished, notify them.

## My recommendations for the approach

- **Process:** keep a `NOTES.md`/`DECISIONS.md` in the repo with open questions and assumptions, make small meaningful commits, and add an AI session export (Claude Code transcript) to `docs/`.
- **Stack (proposal):** TypeScript, Apollo Server or GraphQL Yoga, SQLite (or Postgres in docker-compose), Open-Meteo geocoding + forecast API.
- **Model:** tables `locations` (geocoding) and `forecast_daily` (per day, with `fetched_at`); refresh by TTL (e.g. 3-6 hours) on request, lazy + optionally cron.
- **Scoring:** transparent, separate pure functions per activity (ski: snow/temperature/wind; surfing: waves via the Marine API, wind; outdoor: precipitation/temperature/wind/UV; indoor: inverse of the weather) with tests.
- **Open questions for the README:** what to do for cities without snow or coast (score 0 or "N/A")? a 0-100 scale? units? how to handle ambiguous city names?

Do you want me to make the project skeleton right away (structure, `DECISIONS.md`, GraphQL schema), or should we first discuss the stack choice and assumptions?

## User

Good, let's first create a layout for the task, without any technical things for now: empty DECISIONS.md, README.md, an ai-sessions folder, create the repo, add a gitignore file where we put .vscode, create docs/, also create the basic files for agents (minimal info there for now), and also put the task into a TASK.md file instead of the .pdf, and add it to gitignore. Do all of this for now and make the first commits with conventional commits. Everything in the repo must be in English. Don't fill ai-sessions, I will fill it at the end

> `Bash` : `git init -b main -q && mkdir -p docs ai-sessions && touch docs/.gitkeep ai-sessions/.gitkeep cat > .gitignore <<'EOF' # Editor .vscode/ # Original task brief (k ...`
> `Bash` : `T='Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>' c(){ m="$1"; shift; git add "$@" && git commit -q -m "$m" -m "$T"; } c "chore: add gitignore" .git ...`
> `Bash` : `T='Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>' commit_files(){ m="$1"; shift; git add "$@" && git commit -q -m "$m" -m "$T"; } commit_files "chor ...`

## Claude

Done. The local git repo is created (branch `main`), the working tree is clean.

**Structure:**
- `TASK.md` - the task text in English (instead of the PDF)
- `README.md`, `DECISIONS.md` - placeholders with TODO
- `AGENTS.md` - minimal: project description, conventions (English, Conventional Commits, record decisions in DECISIONS.md, no frontend)
- `CLAUDE.md` - just `@AGENTS.md`, to avoid duplication
- `docs/`, `ai-sessions/` - empty, with `.gitkeep` (git does not track empty folders)
- `.gitignore` - `.vscode/`, `.DS_Store` and the original PDF (the file stays on disk, it just is not committed)

**Commits (5):**
```
chore: add gitignore
docs: add task brief
docs: add README and DECISIONS placeholders
docs: add agent instructions
chore: add docs and ai-sessions directories
```

Note: `ai-sessions/` contains a `.gitkeep`; once you fill it, it can be removed. I did not add a remote; tell me when the GitHub repo exists and I will connect it and push.

## User

Remove TASK.md from git and add it to gitignore, and remove the pdf file from the repo as well

> `Bash` : `rm -f lead-snr-engineer-test-062026.pdf && rm -rf .git && git init -b main -q cat > .gitignore <<'EOF' # Editor .vscode/ # Task brief (kept locally only) TASK.m ...`

## Claude

Done. I rebuilt the history from scratch (the repo was local, nothing had been pushed).

- **`TASK.md`**: stays on disk, is in `.gitignore`, and is in no commit.
- **PDF**: deleted from disk, and removed from both `.gitignore` and the history (`git log --all` has zero matches for `pdf`/`TASK`).
- **History (4 commits):**
  ```
  chore: add gitignore
  docs: add README and DECISIONS placeholders
  docs: add agent instructions
  chore: add docs and ai-sessions directories
  ```

Note: `AGENTS.md` links to `[TASK.md](TASK.md)`, but the file will not be in the public repo, so the link will be broken. Do you want me to remove this link (or rephrase it so it does not point to a file)? This would be a new commit, no need to touch the history.

## User

I will fill in DECISIONS.md myself at the end, so remove it from the agent instructions, and also remove this: "- Keep the scope focused; no front end."

> `Bash` : `python3 -I - <<'EOF' p='AGENTS.md' s=open(p).read() s=s.replace("- Record non-trivial decisions, assumptions and open questions in [DECISIONS.md](DECISIONS.md). ...`
> `Bash` : `git commit -qam "docs: trim agent conventions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" && git log --oneline | head -1`

## Claude

I removed both items from [AGENTS.md](AGENTS.md) (the link to DECISIONS.md and "Keep the scope focused; no front end") and committed: `71589cd docs: trim agent conventions`.

The `TASK.md` link in the Project section is still there, and the file is in gitignore. If you want, tell me and I will remove it.
