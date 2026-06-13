# RepLog — Vault

**Name:** RepLog · **Status:** Active · **Phase:** MVP complete (0–5); offline-first UX shift in progress.

This is the documentation vault (Obsidian-friendly, plain Markdown). It is organized in three layers. New here? Read `constitution.md` first, then this map.

## What it is
Mobile app to log strength training set by set (weight, reps, proximity to failure) for **hypertrophy**, with week-over-week tracking. Offline-first. The data model is built to scale to programming, AI, and nutrition (logic not built now).

## Stack
| Layer | Choice |
|---|---|
| App | React Native + **Expo** (managed), Android first · TypeScript |
| Backend | **Supabase** (Postgres + Auth) |
| Data | **offline-first** with Legend-State + Supabase sync |
| i18n | react-i18next, Spanish default |

## Vault map (three layers)

- **`constitution.md`** — immutable principles + the mandatory English-only language policy. Read first.

- **`specs/`** — the *what* (source of truth, stable):
  - `Vision.md` — problem, goals, non-goals
  - `Architecture.md` — stack, offline-first, **data model**
  - `Tracking.md` — logging flow, per-set capture, PRs, retroactive
  - `Design-UX.md` + `UI-Mockups/` — navigation and screens
  - `Exercise-Catalog.md` — taxonomy and muscle figure
  - `AI-Programming.md` — data strategy for the future LLM
  - `SQL-Schema.md` + `sql/` — how to apply the DB
  - `Feed.md` — out of MVP (future)

- **`process/`** — the *when/how* (living):
  - `STATE.md` — current build status (start here to know where we are)
  - `Roadmap.md` · `Backlog.md` · `Build-Plan.md` · `Known-Issues.md`
  - `decisions/` — ADRs (MADR format)
  - `Discussion-Decisions.md` — historical archive of the original spec rounds

- **`tickets/`** — the *work*:
  - `INDEX.md` — the board · one `TKT-NNNN-*.md` per ticket

## For AI agents
See [`../AGENTS.md`](../AGENTS.md) (repo root). Pick up work from `tickets/INDEX.md`.
