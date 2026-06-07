# Claude Code toolkit — RepLog

Configuration so Claude Code builds RepLog following the specs in `/docs` (source of truth) and `CLAUDE.md` (domain rules).

## Agents (`.claude/agents/`)
Specialized subagents; Claude invokes them or you call them by name.
- **spec-guardian** — verifies code against the specs (read-only).
- **code-reviewer** — reviews diffs (quality, security, offline-first, i18n).
- **offline-data-engineer** — Legend-State observables, Supabase sync, RLS, migrations.
- **ux-implementer** — builds screens from the wireframes + tokens + a11y.

## Commands (`.claude/commands/`)
Slash commands for repeated flows:
- `/start-phase <0-5>` — start a Build Plan phase (steps + criteria).
- `/acceptance <0-5>` — check a phase's acceptance criteria.
- `/check-spec [area]` — verify against the specs (via spec-guardian).
- `/review` — review the current diff (via code-reviewer).
- `/new-screen <name>` — scaffold a screen faithful to the wireframe.
- `/add-i18n [area]` — externalize hardcoded text to `es.json`.
- `/db-change <description>` — schema change syncing docs/sql.

## Skills (`.claude/skills/`)
Project knowledge Claude loads when relevant:
- **hypertrophy-formulas** — 1RM, fractional volume, sets per muscle, PR.
- **legend-state-sync** — offline-first data layer (Legend-State + Supabase).
- **i18n** — internationalization rules.
- **rn-screen-patterns** — design tokens, components, and screen patterns.

## Recommended MCP
- **context7** (already configured in `.mcp.json`): up-to-date docs for Expo, Legend-State, Supabase, react-i18next, etc. Use it before writing integration code to avoid stale APIs.
- **Supabase MCP** (optional, needs your token): to manage the DB and run migrations from Claude Code. Add it to `.mcp.json` when you have the project. Never commit tokens.

## Tooling suggestions (build phase)
- **Maestro** for mobile E2E tests of the main loop.
- **ESLint + Prettier + TypeScript strict** from Phase 0.
- **EAS Build** to produce the Android APK/AAB.

## Suggested flow
1. `/start-phase 0` → build → `/review` → `/check-spec` → `/acceptance 0`.
2. Repeat per phase. Don't advance without green acceptance criteria.
