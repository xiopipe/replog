# Vault Restructure — Design Spec

> Status: **approved, pending implementation plan** · Date: 2026-06-12 · Decision-makers: felipe
> Language: English (per the mandatory language policy defined below). Human conversation is Spanish; everything written to the repo is English.

## 1. Goal

Reorganize the `docs/` vault from a flat pile of spec files into a **three-layer, standard-aligned, AI-agent-ready** structure, so that at any moment anyone (human or AI) can answer:

- **What is the app?** → `specs/` (source of truth, stable)
- **Where are we and what did we decide?** → `process/` (living: state, roadmap, decisions)
- **What do I do right now?** → `tickets/` (granular, executable units)

This solves the concrete pain: the codebase is a complete MVP (phases 0–5 done, 72 tests passing) but the vault did not record that state, so no one could tell what was built, skipped, or pending.

## 2. State-of-the-art alignment (2026)

The structure mirrors the converged 2026 industry standards, all plain Markdown, no vendor lock-in:

- **Spec-Driven Development (GitHub Spec Kit)** — Constitution → Spec → Plan → Tasks → Implement; each phase a Markdown artifact. A `constitution.md` of immutable principles is foundational.
- **AGENTS.md** — cross-agent entry file (Agentic AI Foundation / Linux Foundation), read by 20+ agents. `README.md` is for humans; `AGENTS.md` is for agents.
- **Backlog.md** — one `.md` per ticket with YAML frontmatter + acceptance criteria; pure markdown in-repo, optional CLI/Kanban later via custom path config.
- **MADR** — Markdown Architectural Decision Records for the decisions log.
- **EARS** — Easy Approach to Requirements Syntax for testable acceptance criteria (`WHEN <trigger> THE SYSTEM SHALL <response>`).

Sources consulted: agents.md, github/spec-kit, MrLesk/Backlog.md, adr.github.io/madr, BCMS/MarkTechPost 2026 SDD guides.

## 3. Mandatory language policy (NEW — constitution-level)

**Everything written to the repository is in English**: code, comments, specs, SQL schemas, tickets, ADRs, commit messages, PR descriptions, and all documentation.

The **only** exceptions:
1. **End-user app text** delivered through i18n (`src/i18n/es.json`) — Spanish is the product language.
2. **Human conversation** with the user — Spanish.

This rule is written verbatim into `constitution.md` and referenced from `AGENTS.md` and `CLAUDE.md`. It is non-negotiable and applies to every agent and every session.

## 4. Target layout

```
repo/
  AGENTS.md                 NEW — cross-agent entry. Points to constitution + vault + how to pick up work.
  CLAUDE.md                 KEPT, slimmed — delegates to AGENTS.md + constitution; keeps .claude toolkit notes.
  docs/
    README.md               vault map (renamed from Overview.md)
    constitution.md         NEW — immutable project principles + language policy

    specs/                  THE WHAT (source of truth, stable)
      Vision.md
      Architecture.md
      Tracking.md
      Design-UX.md
      Exercise-Catalog.md
      AI-Programming.md
      SQL-Schema.md
      Feed.md
      UI-Mockups.md
      UI-Mockups/           (SVG wireframes)
      sql/                  01_schema.sql · 02_seed_exercises.sql  (moved with its prose spec)

    process/                THE WHEN/HOW (living)
      STATE.md              NEW — single source of truth on what is built (audit baseline, kept current)
      Roadmap.md
      Backlog.md
      Build-Plan.md
      Known-Issues.md
      Discussion-Decisions.md   (historical archive of the original 20 spec rounds)
      decisions/            NEW — MADR ADRs
        0000-record-architecture-decisions.md
        0001-defer-auth-local-identity.md
        0002-hybrid-home-screen.md
      vault-restructure.design.md   (this file)

    tickets/                THE WORK (Backlog.md format, lives in the vault)
      INDEX.md              NEW — board: table of all tickets with status
      _TEMPLATE.md          NEW — ticket template
      TKT-0001-defer-auth-local-identity.md
      TKT-0002-hybrid-home-screen.md
      TKT-0003-profiles-optional-fields-migration.md
      TKT-0004-catalog-seed-expand.md
      TKT-0005-superset-dropset-ui-polish.md
```

## 5. Migration map (current → target)

| Current | Target |
|---|---|
| `docs/Overview.md` | `docs/README.md` |
| `docs/Vision.md` | `docs/specs/Vision.md` |
| `docs/Architecture.md` | `docs/specs/Architecture.md` |
| `docs/Tracking.md` | `docs/specs/Tracking.md` |
| `docs/Design-UX.md` | `docs/specs/Design-UX.md` |
| `docs/Exercise-Catalog.md` | `docs/specs/Exercise-Catalog.md` |
| `docs/AI-Programming.md` | `docs/specs/AI-Programming.md` |
| `docs/SQL-Schema.md` | `docs/specs/SQL-Schema.md` |
| `docs/Feed.md` | `docs/specs/Feed.md` |
| `docs/UI-Mockups.md` | `docs/specs/UI-Mockups.md` |
| `docs/UI-Mockups/` | `docs/specs/UI-Mockups/` |
| `docs/sql/` | `docs/specs/sql/` |
| `docs/Roadmap.md` | `docs/process/Roadmap.md` |
| `docs/Backlog.md` | `docs/process/Backlog.md` |
| `docs/Build-Plan.md` | `docs/process/Build-Plan.md` |
| `docs/Known-Issues.md` | `docs/process/Known-Issues.md` |
| `docs/Discussion-Decisions.md` | `docs/process/Discussion-Decisions.md` |

All moves use `git mv` to preserve history.

## 6. Reference updates (must not break)

Every path reference to the moved files must be updated. Affected files (from grep):

- `CLAUDE.md` (source-of-truth list, `/docs/sql`)
- `.claude/README.md`
- `.claude/agents/spec-guardian.md`
- `.claude/agents/offline-data-engineer.md` (`docs/sql`, `docs/Architecture.md`)
- `.claude/agents/ux-implementer.md` (`docs/UI-Mockups`, `docs/Design-UX.md`)
- `.claude/commands/new-screen.md` (`docs/UI-Mockups/`)
- `.claude/commands/db-change.md` (`docs/sql`, `docs/Architecture.md`)
- `.claude/commands/acceptance.md` (`docs/Build-Plan.md`)
- `.claude/commands/start-phase.md` (`docs/Build-Plan.md`)
- `.claude/commands/check-spec.md` (`/docs`)
- `.claude/skills/rn-screen-patterns/SKILL.md` (`docs/UI-Mockups`, `docs/Design-UX.md`)
- `.claude/skills/legend-state-sync/SKILL.md` (`docs/Architecture.md`, `docs/sql`)

Acceptance: a repo-wide grep for the old paths returns zero stale references.

## 7. New artifacts — content outlines

### 7.1 `docs/constitution.md`
Immutable principles distilled from `CLAUDE.md` domain rules, plus the language policy:
- Product goal: hypertrophy (per-muscle volume, proximity to failure RIR 0–3; no real 1RM).
- Offline-first: UI always reads/writes local observables, never blocks on network.
- i18n: Spanish default, no hardcoded visible text; all strings via `t()` / `es.json`.
- **Language policy (§3)** — English for all repo artifacts.
- Data rules: client uuid PKs, `updated_at` on every write, soft delete (`deleted_at`), dual weight storage (`weight_value`+`weight_unit`+`weight_kg`), RLS by `user_id`.
- Domain invariants: fractional volume (primary 1.0 / secondary 0.5), PR = beats est. 1RM or rep-PR, warm-ups never count, bodyweight field = added load.
- Out of scope: AI/programming, nutrition, body metrics, social feed, iOS, multiple plans, rest-timer-with-alert, advanced analytics.

### 7.2 `AGENTS.md` (repo root)
Cross-agent operating manual:
- Project one-liner + link to `docs/constitution.md` and `docs/specs/`.
- Setup/build/test commands (`npm install`, `npx expo start`, `npm run lint|typecheck|test`).
- How to pick up work: read `docs/tickets/INDEX.md`, choose a `todo` ticket, follow its acceptance criteria.
- Conventions: English everywhere, offline-first, i18n, data rules (link to constitution).
- Do-not-touch boundaries (generated files, `android/`, secrets).

### 7.3 `docs/process/STATE.md`
The audit baseline, kept current:
- Per-phase table (0–5) with status DONE/PARTIAL and short evidence.
- "Current focus" section.
- "Known pending" list (profiles migration, catalog seed, superset/dropset UI, auth-defer, Maestro E2E).

### 7.4 `docs/tickets/INDEX.md`
Plain Markdown board (no plugins): table of `id | title | status | phase | depends_on`.

## 8. Templates

### 8.1 Ticket — `docs/tickets/_TEMPLATE.md`
```markdown
---
id: TKT-NNNN
title: <imperative summary>
status: todo            # todo | in-progress | blocked | done | skipped
phase: <n>
labels: []
depends_on: []
spec_refs: []
created: YYYY-MM-DD
---

## Context
<why this exists; link specs/ADRs with [[wikilinks]]>

## Acceptance criteria (EARS)
- WHEN <trigger> THE SYSTEM SHALL <response>.

## Implementation notes
<pointers, files, gotchas>

## Out of scope
<explicit non-goals>
```

### 8.2 ADR — `docs/process/decisions/_TEMPLATE.md` (MADR)
```markdown
---
status: accepted        # proposed | accepted | rejected | deprecated | superseded by NNNN
date: YYYY-MM-DD
decision-makers: [felipe]
---
# NNNN. <title>

## Context and Problem Statement
## Considered Options
## Decision Outcome
Chosen option: "<option>", because <justification>.
### Consequences
```

## 9. Seed content (created in this restructure)

ADRs (capturing decisions already made in this session):
- **0000** — Record architecture decisions (meta, why we use ADRs).
- **0001** — Defer auth; local anonymous identity with seamless claim on registration.
- **0002** — Hybrid home screen as the initial screen (action-first + weekly context).

Tickets (from the real gap audit + this session's UX decisions):
- **TKT-0001** — Defer auth: local anonymous identity + claim/migrate on registration.
- **TKT-0002** — Hybrid home screen (initial screen, no mandatory login).
- **TKT-0003** — Add migrations for optional `profiles` fields (level, days, equipment, priorities, limitations).
- **TKT-0004** — Expand exercise catalog seed (~36 → ~60 curated).
- **TKT-0005** — Superset/dropset visual grouping polish in session UI.

Note: the broader "features / fichas" brainstorm is **not** in this restructure; it will produce additional ADRs/tickets afterward.

## 10. Decisions captured this session (to become ADRs)

### 0001 — Defer auth, local anonymous identity
- First launch generates a local `user_id` on device; sync OFF; fully offline from second zero, even with no network on first launch.
- Local data uses the exact same schema as an authenticated user.
- On formal registration (email/Google from Settings): rewrite local `user_id` → real `auth.uid()` across all rows, create the real `profile`, enable sync, push everything up. Because nothing was ever synced before, there are no duplicates or conflicts. Zero extra steps, zero discrepancies.
- Defaults on entry without asking: Spanish, kg, RIR.

### 0002 — Hybrid home screen
- Action-first: large "Start workout" button at top (starts a blank session instantly; exercises added on the fly — already supported by the data model).
- Below: shortcuts (repeat last, plan week) + weekly strip for context.
- Works for a brand-new user with no plan, and stays useful for veterans.
- Login is relegated to a non-intrusive nudge from Settings, never a gate.

## 11. Out of scope (for this restructure)

- No code changes to the app (this is docs/process only). TKT-0001/0002 implement the UX changes later.
- No external tooling installed (no Backlog.md CLI, no Obsidian plugins required). Format is CLI-compatible if adopted later.
- The features/fichas brainstorm is deferred to a follow-up.

## 12. Acceptance criteria (for the restructure itself)

- WHEN the restructure is complete THE SYSTEM SHALL present `docs/` with `specs/`, `process/`, `process/decisions/`, and `tickets/` subfolders as specified.
- WHEN any moved spec is referenced from `CLAUDE.md` or `.claude/` THE SYSTEM SHALL resolve to the new path (zero stale references on grep).
- WHEN an agent starts THE SYSTEM SHALL expose `AGENTS.md` at the repo root pointing to `docs/constitution.md`, `docs/specs/`, and `docs/tickets/INDEX.md`.
- WHEN `docs/constitution.md` is read THE SYSTEM SHALL state the mandatory English language policy verbatim.
- WHEN `docs/process/STATE.md` is read THE SYSTEM SHALL show the per-phase build status baseline.
- WHEN `docs/tickets/INDEX.md` is read THE SYSTEM SHALL list TKT-0001..0005 with status.
- All new written content is in English.
- `git mv` preserves history for moved files.
