# CLAUDE.md — RepLog

Claude-specific entry point. **Start by reading [`AGENTS.md`](AGENTS.md) and [`docs/constitution.md`](docs/constitution.md)** — they hold the cross-agent operating manual and the immutable principles (including the **mandatory English-only language policy** for all repo artifacts). This file only adds Claude-toolkit specifics; it does not duplicate them.

## Source of truth (`docs/`)

The vault is organized in three layers:

- **`docs/specs/`** — the *what* (source of truth, stable):
  - `Vision.md` · `Architecture.md` · `Tracking.md` · `Design-UX.md` + `UI-Mockups/` · `Exercise-Catalog.md` · `AI-Programming.md` · `SQL-Schema.md`
  - `sql/01_schema.sql`, `sql/02_seed_exercises.sql` — database.
- **`docs/process/`** — the *when/how* (living): `STATE.md` (current build status) · `Roadmap.md` · `Backlog.md` · `Build-Plan.md` · `Known-Issues.md` · `decisions/` (ADRs, MADR format) · `Discussion-Decisions.md` (historical archive).
- **`docs/tickets/`** — the *work*: `INDEX.md` (board) + one `TKT-NNNN-*.md` per ticket.

Consult the specs before implementing; if something is undefined, ask instead of inventing.

## How to work

- **Pick up work** from `docs/tickets/INDEX.md`; follow each ticket's EARS acceptance criteria. Keep `docs/process/STATE.md` current as tickets complete.
- Record significant decisions as ADRs in `docs/process/decisions/`.
- `docs/process/Build-Plan.md` ordered the original MVP phases (0–5, now built); STATE.md reflects reality.
- Obey the constitution: offline-first, i18n (Spanish app text, no hardcoded strings), data rules, and **English for everything written to the repo**.
- Apply SQL exactly as in `docs/specs/sql/`; do not redo the schema without updating `docs/specs/sql/` and `docs/specs/Architecture.md`.

## Toolkit (`.claude/`)

Project-specific agents, commands, and skills (see `.claude/README.md`).
- Commands: `/start-phase`, `/acceptance`, `/check-spec`, `/review`, `/new-screen`, `/add-i18n`, `/db-change`.
- Agents: `spec-guardian`, `code-reviewer`, `offline-data-engineer`, `ux-implementer`.
- Skills: `hypertrophy-formulas`, `legend-state-sync`, `i18n`, `rn-screen-patterns`.
- MCP `context7` (in `.mcp.json`) for up-to-date library docs.

## Commands

- Install: `npm install`
- Dev: `npx expo start`
- Checks: `npm run lint` · `npm run typecheck` · `npm test`
- Android build: `eas build -p android`
