# SQL Schema

Implementation of the `Architecture.md` data model for Supabase/Postgres. Files:
- `sql/01_schema.sql` — enums, tables, triggers, indexes, and RLS.
- `sql/02_seed_exercises.sql` — global catalog (~36 exercises) with muscles.

## How to apply it
1. Create the project in Supabase (you do this; accounts and credentials are yours).
2. Supabase → **SQL Editor** → paste `01_schema.sql` → **Run**.
3. Paste `02_seed_exercises.sql` → **Run**.
4. Enable the **Google** provider in Authentication → Providers (email/password is on by default).

> The SQL is reviewed, but validate it when running on Supabase (it uses `auth.users`, which only exists there).

## Implementation decisions
- **uuid PKs** with `gen_random_uuid()` by default; the client can also generate them (key for offline).
- **`updated_at`** updated by a trigger on every table; **soft delete** with `deleted_at`.
- **`user_id` denormalized** on all child tables (not only roots). Simplifies RLS policies and fits Legend-State per-user synced observables.
- **RLS**: each user only sees/writes their rows. Global exercises (`user_id is null`) and their muscles are **read-only** for everyone.
- **`profiles`** is created on signup (trigger `handle_new_user`).
- **Starter templates**: modeled as global `routines`/`plans` that the app clones; the seed includes global exercises (split templates can be added the same way, by name).

## Offline sync notes (build phase)
- Offline sync is configured with Legend-State + the Supabase sync plugin (per-entity observables filtered by `user_id`). Global tables (exercises) sync as shared read-only data.
- Since every table has `user_id`, `updated_at`, and a uuid PK, they fit the synced observables directly.

## Pending
- Complete the seed up to ~60 exercises and review each one's `instructions`.
- Define the starter split templates (Full body 3-day, Upper/Lower, PPL) as global data.
