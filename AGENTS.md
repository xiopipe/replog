# AGENTS.md — RepLog

Cross-agent operating manual. Any coding agent (Claude Code, Codex, Cursor, Gemini, Aider, …) reads this first. `README.md` is for humans; this file is for agents.

## What RepLog is

Offline-first mobile app (Expo + React Native, Android first) to log strength training for **hypertrophy**: plan routines, log sets (weight / reps / proximity to failure), works fully offline. Stack: Expo Router · TypeScript · Supabase (Postgres + Auth) · Legend-State + Supabase sync plugin · react-i18next (Spanish default).

## Source of truth — the Obsidian vault

All product documentation lives **only** in the Obsidian vault, **not in this repo**:

```
~/Documents/Obsidian Projects/01 - Projects/Fitness Tracker/
```

The repo keeps only the **agent contract**: `docs/constitution.md`, this `AGENTS.md`, and `CLAUDE.md`. Everything else (specs, tickets, decisions, state) is in the vault. Note: the vault is outside git — a fresh clone or CI will not have it; it is expected to be present on the developer's machine.

## Read these before doing anything

1. **`docs/constitution.md`** (in repo) — immutable principles. **Includes the mandatory English-only language policy for everything written.** Obey it.
2. The vault's **specs** — `01 - Vision/`, `02 - Features/`, `03 - Arquitectura/`, `04 - Diseno & UX/`, `07 - SQL/`, `08 - Build Plan/`.
3. The vault's **`STATE.md`** — where the project currently stands (what is built / pending).

## How to pick up work

- Open the vault's **`Tickets/INDEX.md`** (the board). Choose a ticket with `status: todo` whose `depends_on` are all `done`.
- Follow the ticket's **EARS acceptance criteria** exactly. Update its `status` as you progress and reflect completion in the vault's `STATE.md`.
- Record any significant decision as an ADR in the vault's `Decisions/` folder (MADR format).

## Documentation-first (MANDATORY)

Before implementing any new feature, behavior change, or architectural decision, it MUST be documented in the vault first (ADR if a decision + spec update if behavior/data changes + ticket(s) with EARS criteria). **Proactively dispatch the `vault-scribe` agent** whenever the conversation produces new scope or a decision that is not yet in the vault — then implement from the resulting ticket. Code without a backing ticket is out of process. See `docs/constitution.md` §7.1.

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
- The synced shape **mirrors** the executable migrations in `supabase/migrations/` (canonical SQL spec lives in the vault's `07 - SQL/`). Change both together.

## Do not touch

- Secrets / `.env` (never commit keys).
- Generated/native dirs (`android/`, build output).
- Do not redo the DB schema without updating `supabase/migrations/` **and** the vault's `07 - SQL/` + `03 - Arquitectura/Arquitectura.md`.

## Project toolkit

`.claude/` holds project-specific agents, commands, and skills (see `.claude/README.md`). `CLAUDE.md` is the Claude-specific entry and delegates to this file and the constitution.
