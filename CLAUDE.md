# CLAUDE.md — RepLog

Context for Claude Code. This file lives at the **repo root**. The specs in `/docs` (copied from the Obsidian vault) are the **source of truth**: consult them before implementing, and if something is undefined, ask instead of inventing.

## What RepLog is
A mobile app to log strength training with a **hypertrophy** goal. The MVP is about **logging** (plan routines + log sets with weight/reps/proximity to failure) working **offline**. The data model is designed to scale to AI-driven programming later, but **that is not built now**.

## Stack
- Expo (managed) + TypeScript · Expo Router · Android first.
- Supabase (Postgres + Auth: email/password + Google).
- Legend-State + Supabase sync plugin for offline-first (no separate server).
- react-i18next + expo-localization (Spanish is the default app language).
- Muscle figure in the style of `react-native-body-highlighter`.

## Source of truth (`/docs`)
- `Vision.md` — goal, scope, non-goals.
- `Tracking.md` — session flow, per-set capture, PRs, retroactive logging.
- `Architecture.md` — stack, offline-first, and data model.
- `Design-UX.md` + `UI-Mockups/` — navigation and screens (SVG wireframes).
- `Exercise-Catalog.md` — taxonomy (8 muscle groups), muscle figure.
- `AI-Programming.md` — what data to prepare (do NOT build logic yet).
- `sql/01_schema.sql`, `sql/02_seed_exercises.sql` — database.
- `Build-Plan.md` — ordered work by phases with acceptance criteria. **Follow it in order.**

## Toolkit (`.claude/`)
Project-specific agents, commands, and skills (see `.claude/README.md`).
- Commands: `/start-phase`, `/acceptance`, `/check-spec`, `/review`, `/new-screen`, `/add-i18n`, `/db-change`.
- Agents: `spec-guardian`, `code-reviewer`, `offline-data-engineer`, `ux-implementer`.
- Skills: `hypertrophy-formulas`, `legend-state-sync`, `i18n`, `rn-screen-patterns`.
- MCP `context7` (in `.mcp.json`) for up-to-date library docs.
- Per-phase flow: `/start-phase N` → build → `/review` → `/check-spec` → `/acceptance N`.

## How to work
- Execute the **Build Plan phase by phase**; do not advance without meeting the acceptance criteria.
- **Real offline-first**: the UI always reads/writes local Legend-State observables; never block on the network.
- **i18n**: no hardcoded visible text; everything in `es.json` via `t()`. (App default language is Spanish.)
- **Data**: client-generated uuid PKs; `updated_at` on every write; delete = `deleted_at` (soft delete); weight stored canonically in `weight_kg` plus what was typed (`weight_value`+`weight_unit`); RLS by `user_id`.
- Apply the SQL exactly as in `/docs/sql`; do not redo the schema without updating the spec.

## Domain rules (don't forget)
- **Hypertrophy**: prioritize per-muscle volume and proximity to failure (RIR 0–3). Not powerlifting; no real 1RM testing.
- **Fractional volume**: a set contributes `contribution` per muscle (primary 1.0, secondary 0.5) via `exercise_muscles`.
- **PR** = beats estimated 1RM (Epley/Brzycki) **or** rep-PR (more reps at weight ≥ previous). **Warm-ups (`is_warmup`) never count** toward PRs or volume.
- **Bodyweight** (`is_bodyweight`): the weight field is the **added load** (0 allowed); bodyweight is not added.
- **Session** = focused exercise-by-exercise walkthrough ("Next exercise"); session and each exercise are timed automatically.

## Out of scope (do NOT build)
AI/programming, nutrition, body metrics, social feed, iOS, multiple plans, rest timer with alert, advanced charts/analytics.

## Commands (fill in on init)
- Install: `npm install`
- Dev: `npx expo start`
- Android build: `eas build -p android`
