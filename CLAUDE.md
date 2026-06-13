# CLAUDE.md — RepLog

Claude-specific entry point. **Start by reading [`AGENTS.md`](AGENTS.md) and [`docs/constitution.md`](docs/constitution.md)** — they hold the cross-agent operating manual and the immutable principles (including the **mandatory English-only language policy** for all repo artifacts). This file only adds Claude-toolkit specifics; it does not duplicate them.

## Source of truth

> **The canonical source of truth is the Obsidian vault** at `~/Documents/Obsidian Projects/01 - Projects/Fitness Tracker/`. The repo `docs/` folder is a **secondary English mirror** — kept for in-repo cross-references and tooling, but the vault wins on any conflict.

The vault is organized in three layers:

- **Specs (the *what*, stable):** numbered vault notes — `01 - Vision/`, `02 - Features/` (Tracking, Catálogo de ejercicios, Programación con IA, Feed), `03 - Arquitectura/`, `04 - Diseno & UX/`, `07 - SQL/`, `08 - Build Plan/`. Mirrored in `docs/specs/`.
- **Decisions (ADRs):** vault `Decisions/NNNN-title.md` (MADR format). Mirrored in `docs/process/decisions/`.
- **Tickets (actionable work):** vault `Tickets/INDEX.md` (board) + `Tickets/TKT-NNNN-*.md`. Mirrored in `docs/tickets/`.
- **Process (the *when/how*, living):** vault `STATE.md` + `05 - Roadmap/` + `06 - Backlog/` + `09 - Known Issues/`. Mirrored in `docs/process/`.

Consult the vault specs before implementing; if something is undefined, ask instead of inventing.

## How to work

- **Pick up work** from `docs/tickets/INDEX.md`; follow each ticket's EARS acceptance criteria. Keep `docs/process/STATE.md` current as tickets complete.
- Record significant decisions as ADRs in `docs/process/decisions/`.
- **Documentation-first (MANDATORY):** before coding any new feature/decision, dispatch the **`vault-scribe`** agent to document it (ADR + spec + tickets with EARS), then build from the ticket. See `docs/constitution.md` §7.1.
- `docs/process/Build-Plan.md` ordered the original MVP phases (0–5, now built); STATE.md reflects reality.
- Obey the constitution: offline-first, i18n (Spanish app text, no hardcoded strings), data rules, and **English for everything written to the repo**.
- Apply SQL exactly as in `docs/specs/sql/`; do not redo the schema without updating `docs/specs/sql/` and `docs/specs/Architecture.md`.

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
