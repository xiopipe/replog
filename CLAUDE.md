# CLAUDE.md — RepLog

Claude-specific entry point. **Start by reading [`AGENTS.md`](AGENTS.md) and [`docs/constitution.md`](docs/constitution.md)** — they hold the cross-agent operating manual and the immutable principles (including the **mandatory English-only language policy** for all repo artifacts). This file only adds Claude-toolkit specifics; it does not duplicate them.

## Source of truth — the Obsidian vault

> **All product documentation lives ONLY in the Obsidian vault** at `~/Documents/Obsidian Projects/01 - Projects/Fitness Tracker/`. It is **not** mirrored in this repo. The repo keeps only the agent contract: `docs/constitution.md`, `AGENTS.md`, `CLAUDE.md`. The vault is outside git (present on the dev's machine; absent on a fresh clone / CI).

The vault is organized in three layers:

- **Specs (the *what*, stable):** numbered notes — `01 - Vision/`, `02 - Features/` (Tracking, Catálogo de ejercicios, Programación con IA, Feed), `03 - Arquitectura/`, `04 - Diseno & UX/`, `07 - SQL/`, `08 - Build Plan/`.
- **Decisions (ADRs):** `Decisions/NNNN-title.md` (MADR format).
- **Tickets (actionable work):** `Tickets/INDEX.md` (board) + `Tickets/TKT-NNNN-*.md`.
- **Process (the *when/how*, living):** `STATE.md` + `05 - Roadmap/` + `06 - Backlog/` + `09 - Known Issues/`.

Consult the vault before implementing; if something is undefined, ask instead of inventing.

## How to work

- **Pick up work** from the vault's `Tickets/INDEX.md`; follow each ticket's EARS acceptance criteria. Keep the vault's `STATE.md` current as tickets complete.
- Record significant decisions as ADRs in the vault's `Decisions/`.
- **Documentation-first (MANDATORY):** before coding any new feature/decision, dispatch the **`vault-scribe`** agent to document it in the vault (ADR + spec + tickets with EARS), then build from the ticket. See `docs/constitution.md` §7.1.
- The vault's `08 - Build Plan/` ordered the original MVP phases (0–5, now built); `STATE.md` reflects reality.
- Obey the constitution: offline-first, i18n (Spanish app text, no hardcoded strings), data rules, and **English for everything written**.
- Apply SQL via `supabase/migrations/`; canonical SQL spec is the vault's `07 - SQL/`. Don't redo the schema without updating both + `03 - Arquitectura/Arquitectura.md`.

## Toolkit (`.claude/`)

Project-specific agents, commands, and skills (see `.claude/README.md`).
- Commands: `/start-phase`, `/acceptance`, `/check-spec`, `/review`, `/new-screen`, `/add-i18n`, `/db-change`.
- Agents: `vault-scribe` (documents new scope into the vault), `spec-guardian`, `code-reviewer`, `offline-data-engineer`, `ux-implementer`.
- Skills: `hypertrophy-formulas`, `legend-state-sync`, `i18n`, `rn-screen-patterns`.
- MCP `context7` (in `.mcp.json`) for up-to-date library docs.

## Commands

- Install: `npm install`
- Dev: `npx expo start`
- Checks: `npm run lint` · `npm run typecheck` · `npm test`
- Android build: `eas build -p android`
