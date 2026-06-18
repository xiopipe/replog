/**
 * Central Legend-State sync configuration.
 *
 * Call order (app root, after auth is confirmed):
 *   1. Import `initSync` from this module — it is called once at module load
 *      time so configureSyncedSupabase runs before any observable is created.
 *   2. Use `customSynced` to build per-entity observables (see entity modules).
 *   3. Use `generateId` wherever a client-side uuid is needed.
 *
 * SYNC MODE — full list (no last-sync)
 * -------------------------------------
 * We do NOT set `changesSince: 'last-sync'` anywhere in this project.
 *
 * Legend-State v3's last-sync mode requires a `fieldDeleted` option that points
 * to a boolean column so the plugin can mark remotely-deleted rows for local
 * removal on incremental fetches.  Our schema uses `deleted_at timestamptz`
 * (nullable timestamp) for soft deletes — not a boolean column.  Setting
 * `fieldDeleted: 'deleted_at'` is unsafe on the WRITE path: when Legend
 * internally handles a hard `.delete()` call it writes `{ deleted_at: true }`,
 * which would corrupt the timestamptz column in Postgres.
 *
 * Using the default full-list mode avoids the requirement for `fieldDeleted`
 * entirely and removes the dev warning:
 *   "WARN [legend-state] fieldDeleted is required when using last-sync mode"
 *
 * For MVP data sizes (hundreds of rows per user) a full list fetch on every
 * sync cycle is fast enough.  If incremental sync becomes necessary later,
 * the correct path is to add a separate boolean `is_deleted` column alongside
 * `deleted_at` and wire that as `fieldDeleted`, OR move to the PowerSync /
 * custom list approach described in the vault's `03 - Arquitectura/Arquitectura.md`.
 *
 * SOFT DELETE
 * -----------
 * Soft-delete is handled in two places:
 *   a) Every collection filter excludes soft-deleted rows via
 *      `.is('deleted_at', null)` — they never appear in the local observable.
 *   b) The `softDelete` helper (exported below) writes `deleted_at = now()` +
 *      `updated_at = now()` as a normal update, then removes the entry from
 *      the local observable map so the UI sees it disappear immediately.
 */

import { type Observable } from '@legendapp/state';
import { configureSynced } from '@legendapp/state/sync';
import { configureSyncedSupabase, syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import { observablePersistSqlite } from '@legendapp/state/persist-plugins/expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

/**
 * Generate a client-side uuid v4.
 * `react-native-get-random-values` is imported at the app entry point
 * (before this module loads) so the crypto shim is in place.
 */
export const generateId = (): string => uuidv4();

// ---------------------------------------------------------------------------
// Global persist plugin (expo-sqlite KV store)
// ---------------------------------------------------------------------------

const sqlitePlugin = observablePersistSqlite(Storage);

// ---------------------------------------------------------------------------
// Configure the Supabase sync plugin globally
// ---------------------------------------------------------------------------

configureSyncedSupabase({
  generateId,
  // changesSince is intentionally omitted (defaults to full-list mode).
  // See SYNC MODE comment above for the full rationale.
  //
  // IMPORTANT — do NOT set fieldCreatedAt / fieldUpdatedAt here.
  // The Supabase CRUD plugin uses those hints to tell a CREATE from an UPDATE:
  // if the changed row already has a `created_at` (or `updated_at`) value it is
  // treated as an existing row and pushed via UPDATE … WHERE id = … which
  // silently affects 0 rows for a brand-new record (no insert, no error).
  // Because every client mutation stamps `created_at`/`updated_at` itself, those
  // hints would misclassify *every* insert as an update and nothing would ever
  // reach Postgres. With the hints omitted, the plugin classifies create vs
  // update by whether a previous value exists locally — correct for our
  // client-generated uuid + client-timestamp pattern.
});

// ---------------------------------------------------------------------------
// Pre-configured synced factory
// ---------------------------------------------------------------------------

/**
 * Cross-table FK ordering & eventual consistency
 * ----------------------------------------------
 * Every entity is its own `syncedSupabase` collection, and each collection
 * pushes its dirty rows to Supabase on an independent debounce timer. When a
 * cascade is written locally in one tick — e.g. `createPlanFromTemplate` writes
 * plan → routine → routine_exercises → plan_day, or a session writes
 * workout_session → session_exercises → sets — the per-collection network
 * pushes RACE each other. A child row (plan_days.routine_id, or
 * session_exercises.session_id) can reach Postgres before its parent INSERT
 * commits, and Postgres rejects it with:
 *
 *   insert or update on table "plan_days" violates foreign key constraint
 *   "plan_days_routine_id_fkey"
 *
 * Legend-State does not expose cross-collection sync ordering, so the correct
 * fix for this stack is eventual consistency: keep retrying the rejected child
 * push with backoff until the parent has landed, then it succeeds. The retry
 * config below makes that automatic and bounded (exponential backoff capped at
 * 30s, retried indefinitely so an offline device eventually reconciles on
 * reconnect). `persist.retrySync: true` on each collection persists the pending
 * queue across app restarts so the reconciliation survives a kill mid-cascade.
 */
const RETRY = { infinite: true, backoff: 'exponential', maxDelay: 30_000 } as const;

/**
 * True for sync failures that are EXPECTED during a write cascade and will heal
 * on the next backoff retry once the parent row syncs — they must not be logged
 * at `error` level (that triggers the dev LogBox red overlay and looks like a
 * crash). A foreign-key violation is the canonical case.
 */
function isTransientSyncError(message: string): boolean {
  return /violates foreign key constraint/i.test(message);
}

/**
 * `customSynced` is `syncedSupabase` pre-bound with the global persist plugin.
 * Entity modules call it directly:
 *
 *   const routines$ = observable(customSynced({ supabase, collection: 'routines', ... }))
 */
export const customSynced = configureSynced(syncedSupabase, {
  persist: {
    plugin: sqlitePlugin,
  },
  // Retry failed pushes with exponential backoff so cross-table FK ordering
  // violations self-heal once the parent row lands (see comment above).
  retry: RETRY,
  // Surface sync failures. Transient FK-ordering violations are expected during
  // write cascades and will be retried — log them at `warn` so they stay
  // visible in logs without raising the dev LogBox error overlay. Everything
  // else is a genuine failure (RLS, schema, auth) and stays at `error`.
  onError: (error: unknown) => {
    const message = String(error);
    if (isTransientSyncError(message)) {
      console.warn('[sync] retrying after FK-ordering violation:', message);
    } else {
      console.error('[sync] error:', message);
    }
  },
});

// ---------------------------------------------------------------------------
// Soft-delete helper
// ---------------------------------------------------------------------------

/**
 * Soft-delete a record from a synced observable collection.
 *
 * Usage:
 *   softDelete(routines$, id)
 *
 * What it does:
 *   Writes `deleted_at` and `updated_at` to the local observable entry — the
 *   sync plugin propagates that update to Postgres. The row stays in the local
 *   map (with `deleted_at` set) until the next full fetch naturally excludes it.
 *
 * Why we do NOT call `entry$.delete()` (TKT-0008): collections are configured
 * with `actions: ['read','create','update']` (no `delete`), so `.delete()` only
 * drops the local key — it never issues a Postgres DELETE. Removing the key in
 * the same tick raced the debounced push: if the key vanished before the
 * `deleted_at` UPDATE flushed, Postgres never recorded the timestamp and the row
 * resurrected on the next full fetch (`.is('deleted_at', null)` let it back in).
 * Every read path already filters `!deleted_at`, so writing the timestamp alone
 * makes the row disappear from the UI immediately — no optimistic delete needed.
 *
 * @param collection$ - The synced observable (Record<string, T>).
 * @param id          - The uuid of the row to soft-delete.
 */
export function softDelete<T extends { deleted_at?: string | null; updated_at: string }>(
  collection$: Observable<Record<string, T>>,
  id: string,
): void {
  const now = new Date().toISOString();
  // Cast to any: Legend-State's Observable<Record<string,T>> does not carry a string
  // index signature at the TS level, but the runtime proxy supports dynamic key access.
  const entry$ = (collection$ as any)[id];
  entry$.set((prev: T) => ({ ...prev, deleted_at: now, updated_at: now }));
}
