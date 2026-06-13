# RepLog

Mobile app to log strength training with a **hypertrophy** goal: plan routines and log sets (weight, reps, proximity to failure) working **offline**. Stack: Expo + TypeScript, Supabase + Legend-State (offline sync).

## Getting started (build)
1. Read **`CLAUDE.md`** (root): context, stack, conventions, and domain rules.
2. Follow **the vault's `08 - Build Plan/Build Plan.md`** phase by phase (each step has an acceptance criterion).
3. The specs in **`docs/`** are the **source of truth**. When in doubt, consult them before implementing.

## Documentation (`docs/`)
- `Vision.md` — goal, scope, non-goals.
- `Tracking.md` — session flow and data capture.
- `Architecture.md` — stack, offline-first, and data model.
- `Exercise-Catalog.md` — muscle taxonomy and muscle figure.
- `Design-UX.md` + `UI-Mockups/` — navigation and wireframes (SVG).
- `AI-Programming.md` — data to prepare for the LLM (future phase, do not build).
- `Roadmap.md` · `Backlog.md` · `Discussion-Decisions.md` — phases, ideas, and log.
- `sql/01_schema.sql`, `sql/02_seed_exercises.sql` — database (Supabase).

## Local development
1. `npm install`
2. Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
3. `npm start` (dev client) — Android first.

## Supabase
Schema and seed live as migrations in `supabase/migrations/` and are applied to the
production database via the **Supabase GitHub integration** (deploy on merge to `main`).
Do not run the SQL by hand. The canonical specs remain in `supabase/migrations/` (canonical spec in the vault's `07 - SQL/`).

## MVP scope
Plan routines + weekly plan, log workouts offline (weight/reps/RIR-RPE), history, PRs. **Out of scope:** AI/programming, nutrition, social, iOS, multiple plans.

## Note on language
Code, comments, specs, and identifiers are in English. The app's default user-facing language is **Spanish** (via i18n); UI strings live in `es.json`.
