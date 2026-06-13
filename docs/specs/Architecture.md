# Architecture

> Status: **initial proposal to discuss**. Nothing here is final; it's the base to iterate on.

## Stack
| Layer | Technology | Notes |
|---|---|---|
| Mobile app | React Native + **Expo** (managed) | Android first. TS. Cloud builds (EAS). |
| Backend | **Supabase** | Postgres + Auth + Row Level Security + auto APIs + Realtime. |
| Language | **TypeScript** | Client and, if custom logic is needed, Edge Functions (Deno/TS). |
| Auth | Supabase Auth | Email/password + Google OAuth. |
| Database | **Postgres** (in Supabase) | RLS by `user_id` to isolate data between users. |
| Local layer | **Legend-State** + Supabase sync plugin | Reactive observables + local persistence (see below). No separate sync server. |
| i18n | react-i18next + expo-localization | **Spanish default**; all text externalized so adding a language is just a translation file. |
| Muscle figure | SVG body map (style of `react-native-body-highlighter`) | Highlights worked muscles from `exercise_muscles`. No external images. |

## Offline-first (the delicate part) — engine: **Legend-State + Supabase**
Since Supabase is online by nature, offline-first is achieved with **local state that persists on the device** and syncs with Postgres. **Decision: use Legend-State** (reactive observables) with its **Supabase sync plugin** (`syncedSupabase`), which handles CRUD sync, realtime, the offline queue, and retry. It's a **library only — no separate sync server and no extra cost**.

Implications of choosing Legend-State:
- The app always reads/writes **local observables** (persisted with MMKV/SQLite); the plugin propagates changes to Postgres when there's network. That's why the app feels instant and works offline.
- Supabase Realtime streams changes between a user's devices.
- Per-entity synced observables, filtered by `user_id`; global catalog as a read-only observable.
- Alternatives considered: WatermelonDB (proven in RN, but you write the sync yourself) and PowerSync/ElectricSQL (turnkey engines, but they add a sync service to self-host or pay for). Legend-State wins for a no-extra-cost, low-boilerplate solo build.

### Design rules so offline works
- **Client-generated IDs**: all PKs are **uuid v4 generated on device** (not autoincrement). Allows creating records without network and avoids collisions.
- **Timestamps**: `created_at` and `updated_at` on every row (UTC). The client sets them.
- **Soft delete**: delete = set `deleted_at`, never physical delete (syncable and reversible).
- **Conflict resolution**: **last-write-wins** by `updated_at`. Enough for the MVP: it's almost always the same user on one or two devices; real conflicts are rare.
- **Change queue**: offline operations are queued and resent on reconnect (handled by the chosen sync engine).
- **Cross-table FK ordering → eventual consistency, not ordered pushes**: each entity is its **own** `syncedSupabase` collection that pushes on an independent debounce timer, so when a cascade is written locally in one tick (e.g. plan → routine → routine_exercises → plan_day, or workout_session → session_exercises → sets) the per-collection network pushes **race**. A child row can reach Postgres before its parent INSERT commits and be rejected by the foreign key (`..._fkey`). Legend-State does not expose cross-collection ordering, so the fix is **retry with backoff** (`retry: { infinite: true, backoff: 'exponential', maxDelay: 30000 }` on the global synced config in `src/db/sync.ts`) plus `persist.retrySync: true` per collection: the rejected child push keeps retrying until the parent lands, then succeeds. Foreign-key violations during a cascade are **expected and self-healing** — `onError` logs them at `warn`, reserving `error` for genuine failures (RLS, schema, auth). See `docs/Known-Issues.md` (KI-001).

---

## Data model (proposal)
Designed for the MVP **and** to scale to programming, AI, and nutrition without painful migrations. Conventions: every table has `id uuid pk`, `created_at`, `updated_at`, `deleted_at` (nullable). User-data tables carry `user_id` with RLS.

### MVP entities

**profiles** — user profile (1:1 with Supabase `auth.users`)
- `id` (= auth uid), `display_name`, `unit_preference` (`kg` | `lb`), `default_failure_metric` (`rir` | `rpe` | `none`)
- **Context for the LLM (optional, filled from Settings; doesn't block onboarding):**
  - `experience_level` (`beginner` | `intermediate` | `advanced`)
  - `available_days_per_week` (int) — and optionally `preferred_weekdays` (int[])
  - `equipment` (enum/array: `full_gym` | `dumbbells` | `home` | …)
  - `priority_muscles` (enum[] of the 8 groups) — what to emphasize
  - `limitations` (text / jsonb) — injuries or exercises to avoid

**exercises** — exercise catalog (global + custom)
- `user_id` (nullable: `null` = global predefined exercise; set = user's custom)
- `name`, `category` (`barbell` | `dumbbell` | `machine` | `cable` | `bodyweight` | `other`)
- `is_custom` (bool)
- `is_bodyweight` (bool) — if `true`, the set's weight field represents the **added load** (not bodyweight); the UI labels it "added load" and allows 0.
- `instructions` (text, nullable) — 1–2 sentences of "how to do it". The visual representation (muscle figure) is **derived from `exercise_muscles`**, no image stored.

**exercise_muscles** — exercise → muscle mapping (enables **fractional volume**)
- `exercise_id` (fk), `muscle` (enum of 8 groups), `role` (`primary` | `secondary`), `contribution` (numeric: 1.0 primary, 0.5 secondary by default, editable)
- → Per-muscle volume is computed by summing `contribution` per set. Separate table (instead of columns) so contributions can be tuned and muscles added without migration.

The 8 muscle groups (enum `muscle_enum`): `chest`, `back`, `shoulders`, `arms`, `quads`, `hamstrings_glutes`, `calves`, `core`.

### Routine planning (first-class in the MVP)
**routines** — a single day's routine (exercise sequence; e.g., "Chest", "Legs")
- `user_id`, `name`, `notes`

**routine_exercises** — exercises within a routine (ordered)
- `routine_id` (fk), `exercise_id` (fk), `order_index`, `notes`
- **Targets (all optional; filled by the user or, in the future, the LLM):** `target_sets`, `target_reps_min`, `target_reps_max` (equal = fixed number), `target_weight_kg`, `target_rir`. We don't impose a default target; the field only stores what is prescribed.

**plans** — weekly plan (split). **MVP: a single active plan** per user (multiple-plan management is out of scope; `is_active` kept for the future)
- `user_id`, `name`, `is_active` (bool)

**plan_days** — links routines to a plan (supports flexible **and** fixed days)
- `plan_id` (fk), `routine_id` (fk), `order_index`
- `weekday` (int 0–6, **nullable**): set = fixed day (e.g., Monday=Chest); `null` = flexible day ("Day A/B/C" done when it fits). Covers "both/configurable".

A `workout_session` can be born from a `routine` (`routine_id`), inheriting its exercise sequence — which can then be modified in the moment via ⋮.

**Starter templates**: predefined splits (Full body 3-day, Upper/Lower, PPL…) are modeled as **global** `plans`/`routines` (`user_id = null`). On selecting one, it's **cloned** into the user's account (a copy with its own IDs) so they can edit it. Days with no `plan_day` = **implicit rest** (no "rest" type).

### Workout sessions
**workout_sessions** — an actual training session
- `user_id`, `routine_id` (nullable, if born from a template), `name`
- `started_at`, `ended_at` (nullable while in progress), `status` (`in_progress` | `completed`), `notes`
- `started_at` is **editable**: allows creating/editing past-dated workouts (retroactive logging).

**session_exercises** — exercises performed in a session (focused walkthrough, one by one)
- `session_id` (fk), `exercise_id` (fk), `order_index`, `notes`
- **Automatic per-exercise timing**: `started_at`, `ended_at` (set on "Next exercise"). Per-exercise duration is derived with no typing.
- **Superset/circuit**: `superset_group` (uuid, nullable) + `superset_order` (int, nullable). `session_exercises` sharing `superset_group` are performed together (alternating). `null` = normal exercise.

**sets** — the granular record: **one row per set** (core of the app)
- `session_exercise_id` (fk), `set_index`
- **Weight (strategy C, dual storage):**
  - `weight_value` (numeric) — what the user typed.
  - `weight_unit` (`kg` | `lb`) — the unit they typed in.
  - `weight_kg` (numeric) — value normalized to kg, for analytics and comparisons.
  - → Display `weight_value`+`weight_unit` (exact, no rounding); compute with `weight_kg`.
- `reps` (int)
- `failure_metric` (`rir` | `rpe` | `none`), `rir` (int, nullable), `rpe` (numeric, nullable)
- `is_warmup` (bool), `reached_failure` (bool), `rest_seconds` (int, nullable)
- **Dropset**: `drop_group` (uuid, nullable) + `drop_order` (int, nullable). `sets` sharing `drop_group` form a dropset (same exercise, chained drops). `null` = normal set.
- `performed_at` (timestamp), `notes`
- `metadata` (jsonb) — flexible field for future data (tempo, per-rep RPE, etc.) **without migrating the schema**

> **Grouping modeling note:** **supersets group exercises** (`session_exercises` level) and **dropsets group sets** (`sets` level). That's why each has its own group key. Both are optional: when `null`, everything behaves as a simple set/exercise.

### Relationships
```
profiles 1───* workout_sessions 1───* session_exercises *───1 exercises
                                            │
                                            └──1───* sets

profiles 1───* routines 1───* routine_exercises *───1 exercises
profiles 1───* plans 1───* plan_days *───1 routines
workout_sessions *───1 routines  (optional, if born from a routine)
```

### Scalability hooks (NOT built in the MVP, but anticipated)
- **Programming / periodization**: future tables `programs`, `mesocycles`, `program_days` referencing `routines`.
- **AI / recommendations (hypertrophy)**: the goal is to keep the model **so close to final that the LLM needs no big migration**. We already capture the signals it needs: per-muscle volume (via `exercise_muscles`), proximity to failure (`rir`/`rpe` per set), progression (weight/reps per set over time), times (session and per exercise), and user context (`profiles`). The LLM will write its prescriptions into the `target_*` of `routine_exercises`. Future `recommendations` table (input used → suggestion + reasoning) for traceability. **LLM logic is a later phase; only the model is prepared now.** See `AI-Programming.md`.
- **Nutrition**: future tables `nutrition_logs`, `foods` linked to `user_id` and date; the `metadata` jsonb and per-user separation keep it ready.
- **Body metrics**: future `body_metrics` table (bodyweight, measurements) to cross-reference with performance.
- **Derived analytics** (phase 2): estimated 1RM (Epley/Brzycki from `weight_kg` and `reps`), volume = Σ(`weight_kg` × `reps`), per-exercise PRs, adherence from `workout_sessions`. **Requires no model change**, just queries.

## Security
- **Row Level Security** in Postgres: each user only reads/writes rows with their `user_id`. Global exercises (`user_id is null`) are read-only for everyone.
- Auth handled by Supabase (JWT). We don't store passwords ourselves.

## Open questions
- ~~Offline sync engine~~ → **Legend-State + Supabase sync plugin** ✅ (library only, no separate server)
- ~~Weight storage~~ → **dual storage (strategy C)** ✅
- ~~Realtime between devices~~ → covered by Supabase Realtime via Legend-State ✅
- Seed strategy for the predefined catalog (curated list vs public dataset).
- Do we model `set_groups` as its own table instead of group keys? (for now: group keys, simpler).
