# AGENTS.md — RepLog

Cross-agent operating manual. Any coding agent (Claude Code, Codex, Cursor, Gemini, Aider, …) reads this first. `README.md` is for humans; this file is for agents.

## What RepLog is

Offline-first mobile app (Expo + React Native, Android first) to log strength training for **hypertrophy**: plan routines, log sets (weight / reps / proximity to failure), works fully offline. Stack: Expo Router · TypeScript · Supabase (Postgres + Auth) · Legend-State + Supabase sync plugin · react-i18next (Spanish default).

## Read these before doing anything

1. **`docs/constitution.md`** — immutable principles. **Includes the mandatory English-only language policy for all repo artifacts.** Obey it.
2. **`docs/specs/`** — the source of truth for *what* to build (Vision, Architecture, Tracking, Design-UX, Exercise-Catalog, SQL-Schema, UI-Mockups).
3. **`docs/process/STATE.md`** — where the project currently stands (what is built / pending).

## How to pick up work

- Open **`docs/tickets/INDEX.md`** (the board). Choose a ticket with `status: todo` whose `depends_on` are all `done`.
- Follow the ticket's **EARS acceptance criteria** exactly. Update its `status` as you progress and reflect completion in `docs/process/STATE.md`.
- Record any significant decision as an ADR in `docs/process/decisions/` (MADR format).

## Setup / build / test

```bash
npm install
npx expo start          # dev (Android)
npm run lint
npm run typecheck
npm test                # jest
```

## Conventions (summary; full rules in the constitution)

- **English** for everything written to the repo. Spanish only in `src/i18n/es.json` (product text) and human conversation.
- **Offline-first**: UI reads/writes local Legend-State observables; never block on the network.
- **i18n**: no hardcoded visible text; all strings via `t()` / `es.json`.
- **Data**: client uuid PKs · `updated_at` on every write · soft delete (`deleted_at`) · dual weight storage · RLS by `user_id`.
- The synced shape **mirrors** `docs/specs/sql/01_schema.sql`. Change both together.

## Do not touch

- Secrets / `.env` (never commit keys).
- Generated/native dirs (`android/`, build output).
- Do not redo the DB schema without updating `docs/specs/sql/` **and** `docs/specs/Architecture.md`.

## Project toolkit

`.claude/` holds project-specific agents, commands, and skills (see `.claude/README.md`). `CLAUDE.md` is the Claude-specific entry and delegates to this file and the constitution.
