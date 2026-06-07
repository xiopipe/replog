# Build Plan — RepLog (for Claude Code)

Step-by-step MVP build plan, optimized for **Claude Code** to execute in a fresh repo. The **vault specs are the source of truth**; this plan only orders the work.

## How to use this plan
1. The specs live in `/docs` and `CLAUDE.md` is at the repo root.
2. Execute the phases **in order**. Don't start a phase without meeting the previous one's acceptance criteria.
3. For any behavior or data question, defer to the relevant spec; if the spec doesn't say, ask before inventing.

## Source of truth (specs)
- `Vision.md` — goal (hypertrophy), scope, non-goals.
- `Tracking.md` — session flow, per-set capture, PR, retroactive.
- `Architecture.md` — stack, offline-first, **data model**.
- `SQL-Schema.md` — DDL + seed (`sql/`).
- `Exercise-Catalog.md` — taxonomy (8 groups), muscle figure.
- `Design-UX.md` + `UI-Mockups.md` — navigation and screens.
- `AI-Programming.md` — what data to prepare (future phase, do not build).
- `Roadmap.md` — macro phases · `Backlog.md` — out of scope.

## Stack and conventions (summary; detail in `Architecture.md`)
- **Expo (managed) + TypeScript**, Android target. **Expo Router** (file-based navigation).
- **Supabase** (Postgres + Auth) + **Legend-State** + Supabase sync plugin (local-first, no separate server).
- **react-i18next + expo-localization**, Spanish default, **all text externalized**.
- **Muscle figure**: style of `react-native-body-highlighter`, fed by `exercise_muscles`.
- Data rules: client uuid PKs · `updated_at` · soft delete · canonical `weight_kg` + typed value · RLS by `user_id`.

### Suggested folder structure
```
/app                 routes (expo-router)
/src/components      reusable UI
/src/features        catalog · routines · plan · session · history · settings
/src/db              observables + Supabase sync (Legend-State)
/src/lib             supabase, i18n, utils (1rm, volume, units, dates)
/src/i18n/es.json    text
/docs                specs = source of truth
```

---

## Phase 0 — Foundations

> Concrete setup. **Library versions move fast — confirm current versions and APIs with the `context7` MCP before installing/integrating.** Always prefer `npx expo install <pkg>` over `npm install` for native modules (it picks Expo-SDK-compatible versions). Don't pin versions by hand.

### 0.1 Scaffold the Expo app
The repo already contains `docs/`, `.claude/`, `CLAUDE.md`, `README.md`. Scaffold the Expo app **inside this repo** without overwriting them:
```bash
# from the repo root
npx create-expo-app@latest . --template blank-typescript
# if it refuses because the folder isn't empty, scaffold in a temp dir and copy
# the app files in, keeping docs/, .claude/, CLAUDE.md, README.md.
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar
```
Switch entry to Expo Router (set `"main": "expo-router/entry"` in `package.json`, add the `app/` dir, configure the scheme in `app.json`). Add path alias `@/*` in `tsconfig.json`.

### 0.2 Install dependencies
| Purpose | Command |
|---|---|
| Supabase client | `npm i @supabase/supabase-js` · `npx expo install @react-native-async-storage/async-storage react-native-url-polyfill` |
| Auth (Google OAuth) | `npx expo install expo-auth-session expo-web-browser expo-crypto` |
| Offline sync (Legend-State) | `npm i @legendapp/state` · for local persistence `npx expo install react-native-mmkv` (or expo-sqlite) |
| Client uuid IDs | `npm i uuid` · `npx expo install react-native-get-random-values` |
| i18n | `npm i i18next react-i18next` · `npx expo install expo-localization` |
| Muscle figure | `npm i react-native-body-highlighter` · `npx expo install react-native-svg` |
| Dates/utils | `npm i date-fns` |
| Dev tooling | `npm i -D eslint prettier eslint-config-expo` |

### 0.3 Project config
- **TypeScript strict** in `tsconfig.json`; set up ESLint (`eslint-config-expo`) + Prettier; add `npm` scripts (`start`, `android`, `lint`, `typecheck`, `test`).
- **Env vars** in `.env` (and `.env.example`), read via `expo-constants`/`process.env.EXPO_PUBLIC_*`:
  - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **.gitignore**: `node_modules/`, `.expo/`, `dist/`, `.env`, `*.log`, `ios/`, `android/` (managed).
- Import `react-native-get-random-values` and `react-native-url-polyfill/auto` at the app entry (before other code).

### 0.4 Supabase project
1. Create the Supabase project (the user does this; never commit keys).
2. SQL Editor → run `sql/01_schema.sql`, then `sql/02_seed_exercises.sql`. *(— SQL-Schema.md)*
3. Auth → Providers: enable Google (email/password is on by default).
4. Put the URL + anon key in `.env`.

### 0.5 Integrations
1. **i18n** (react-i18next + expo-localization): init once at entry, default/fallback `es`, create `src/i18n/es.json`, `t()` helper. No hardcoded visible text. *(— skill `i18n`)*
2. **Supabase Auth**: email + Google sign up/in, session persisted with AsyncStorage, offline entry with cached session. *(— Design-UX.md §Onboarding)*
3. **Legend-State + Supabase sync**: per-entity observables persisted locally (MMKV/SQLite), `syncedSupabase` plugin with realtime, filtered by `user_id`, global exercises read-only. The app **always reads/writes local observables**. *(— skill `legend-state-sync`)*
4. Dark theme base + minimal design system tokens. *(— skill `rn-screen-patterns`)*

**Acceptance:** `npx expo start` runs the app on Android; a new user signs up and signs in (even offline after the first login); the local store syncs with Supabase; all visible text comes from i18n; `npm run lint` and `npm run typecheck` pass.

## Phase 1 — Exercise catalog
1. **Exercises/Routines** screen: list the catalog (seed) with search and filter by the **8 groups**. *(— Exercise-Catalog.md)*
2. **Create custom exercise** (name, category, muscles, is_bodyweight, instruction). *(— Architecture.md §exercises)*
3. **Exercise detail**: muscle figure (primary intense, secondary faint, from `exercise_muscles`) + instruction + best estimated 1RM. *(— UI-Mockups exercise-detail)*

**Acceptance:** browse the catalog, filter by group, create a custom exercise, and the figure correctly highlights the muscles.

## Phase 2 — Routines and weekly plan
1. **Routine editor**: create routine, add/reorder (drag) exercises with optional targets (sets, rep range, weight, RIR). *(— UI-Mockups routine-editor; Architecture.md §routine_exercises)*
2. **Weekly plan**: assign routines to days; `weekday` fixed or flexible; days with no routine = **implicit rest**. *(— UI-Mockups weekly-plan)*
3. **Starter templates** (Full body 3-day, Upper/Lower, PPL) clonable + blank option. *(— Design-UX.md §Onboarding/first plan)*

**Acceptance:** the user creates (or clones) a plan with routines and sees it reflected on Home.

## Phase 3 — Session logging (core)
1. **Home**: today's routine, weekly strip, start/resume/repeat last. *(— UI-Mockups home)*
2. **Focused session**: one exercise at a time, "X of N" progress, **automatic session and per-exercise timer**, "Next exercise" button (slide) that closes and saves duration. *(— Tracking.md; UI-Mockups active-session)*
3. **Inline set rows**: weight, reps, RIR/RPE (configurable, profile default), warm-up, added load (is_bodyweight), duplicate set. *(— Tracking.md §capture)*
4. **⋮ actions**: add/swap/skip exercise on the fly. **Supersets/dropsets** (grouping). *(— Architecture.md §grouping)*
5. **PR detection in the moment** (estimated 1RM or rep-PR; warm-ups excluded) with micro-celebration. *(— Tracking.md §PR definition)*
6. **Finish** → **Session summary** (duration, sets per muscle group, PRs). *(— UI-Mockups session-summary)*
7. **Retroactive logging**: create past-dated workout and edit saved sets. *(— Tracking.md)*

**Acceptance:** log a full workout **offline**, with automatic timers, PRs, and summary; syncs on reconnect.

## Phase 4 — History and settings
1. **History**: sessions grouped by week (day, duration, **sets per muscle group**, PR badge); editable session detail. *(— UI-Mockups history)*
2. **Exercise history**: past sets and best mark.
3. **Settings**: kg/lb unit, default failure metric, **optional profile context** (level, days, equipment, priorities, injuries), account/sign out. *(— Architecture.md §profiles)*

**Acceptance:** the full loop (plan → train → review) works offline and syncs; settings persist.

## Phase 5 — Polish and release
1. Empty and error states; i18n coverage; dark mode; accessibility pass (contrast, sizes). *(— Design-UX.md)*
2. Utilities verified with tests (`npm i -D jest jest-expo @testing-library/react-native @types/jest`; add `test` script): estimated 1RM, fractional per-muscle volume, kg/lb conversion, PR detection.
3. Optional E2E with **Maestro** for the main loop (install Maestro CLI separately).
4. Android build with **EAS** (`npm i -g eas-cli` → `eas build -p android`).

**Acceptance:** installable APK/AAB; QA checklist of the main loop green.

---

## Out of scope (do NOT build in the MVP)
AI/programming, nutrition, body metrics, social feed, iOS, multiple plans, rest timer with alert, advanced analytics/charts. *(— Backlog.md)*

## Domain rules the executor must not forget
- **Hypertrophy** goal: per-muscle volume and proximity to failure are what matter.
- **Fractional volume**: primary 1.0, secondary 0.5 (from `exercise_muscles`).
- **PR** = beats estimated 1RM **or** rep-PR; **warm-ups never count**.
- **Bodyweight**: the weight field = added load (0 allowed); bodyweight is not added.
- **Real offline-first**: never block the UI on the network; write local and sync.
