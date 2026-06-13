---
name: legend-state-sync
description: How to implement RepLog's offline-first data layer with Legend-State + the Supabase sync plugin — local persistence, reactive observables, realtime sync, and per-user filtering. Use it when creating or modifying any data access.
---

# Offline-first data layer (Legend-State + Supabase)

RepLog works **without network**. State lives in **Legend-State observables** persisted locally; the **Supabase sync plugin** (`@legendapp/state/sync-plugins/supabase`) handles CRUD sync, realtime, and the offline retry queue. No separate sync server.

> Confirm the current Legend-State v3 + `syncedSupabase` API with the `context7` MCP before wiring it up; options/names move fast.

## Golden rules
1. **The UI never calls Supabase directly** nor waits on the network. It reads/writes Legend-State observables.
2. **Local persistence**: configure a persist plugin (MMKV or SQLite recommended over AsyncStorage for history-heavy data) so data survives restarts and is available offline.
3. **Client-generated uuid IDs** on create (not autoincrement).
4. **`updated_at`** on every write (used by the plugin for incremental sync); **soft delete** via `deleted_at` (queries filter `deleted_at is null`; configure the plugin's deleted field accordingly).
5. **Conflicts**: last-write-wins by `updated_at` (matches the plugin's default).

## Sync setup
- Use `syncedSupabase` per entity/observable. Enable **Supabase Realtime** on the synced tables so changes stream between the user's devices.
- **User data**: one synced observable per entity, filtered by `user_id` (RLS also enforces isolation server-side). Tables: `profiles`, `routines`, `routine_exercises`, `plans`, `plan_days`, `workout_sessions`, `session_exercises`, `sets`, and the user's own `exercises`/`exercise_muscles`.
- **Global data** (`exercises`/`exercise_muscles` with `user_id is null`): a **read-only** synced observable (predefined catalog); never push local writes for these.
- Enable incremental sync (`changesSince`/`updated_at`) and the offline persistence + retry so queued writes flush on reconnect.

## Access pattern
- Encapsulate access in a `src/db/` layer (one module per entity) exposing observables and typed mutations — no loose Supabase calls in views.
- Components read observables reactively (`use$`/`observer`) so they re-render on change.
- Mutations build the full object (uuid + `updated_at`) and write to the observable; the plugin syncs.

## Auth and startup
- First login needs network (Supabase Auth / Google). After authenticating, the session is cached (AsyncStorage) and you can enter offline.
- Initialize the synced observables with the authenticated user's Supabase client/token.

## Status indicators
- Legend-State exposes sync state per observable (pending/synced/error) — surface it in the UI when relevant, without blocking anything.

References: `docs/specs/Architecture.md` (§Offline-first and data model), `docs/specs/sql/`.
