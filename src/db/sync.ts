/**
 * Central Legend-State sync configuration.
 *
 * Call order (app root, after auth is confirmed):
 *   1. Import `initSync` from this module — it is called once at module load
 *      time so configureSyncedSupabase runs before any observable is created.
 *   2. Use `customSynced` to build per-entity observables (see entity modules).
 *   3. Use `generateId` wherever a client-side uuid is needed.
 *
 * SOFT DELETE NUANCE
 * ------------------
 * The schema uses `deleted_at timestamptz` (a nullable timestamp), NOT a boolean
 * `deleted` column. Legend-State's `fieldDeleted` option expects a boolean column
 * that it can flip — we do NOT set it here because it would try to write a column
 * that doesn't exist in that shape.
 *
 * Instead we handle soft-delete in two places:
 *   a) Every collection filter explicitly excludes soft-deleted rows via
 *      `.is('deleted_at', null)` — so they never appear in the local observable.
 *   b) The `softDelete` helper (exported below) writes `deleted_at = now()` +
 *      `updated_at = now()` as a normal update, then removes the entry from
 *      the local observable map so the UI sees it disappear immediately.
 *
 * This matches last-write-wins semantics: the timestamp update goes to Postgres
 * and the row will be excluded by the filter on any subsequent sync.
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
  // Use incremental sync: only fetch rows changed since the last sync timestamp.
  changesSince: 'last-sync',
  // Column names that match 01_schema.sql exactly.
  fieldCreatedAt: 'created_at',
  fieldUpdatedAt: 'updated_at',
  // Do NOT set fieldDeleted — see SOFT DELETE NUANCE above.
});

// ---------------------------------------------------------------------------
// Pre-configured synced factory
// ---------------------------------------------------------------------------

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
 *   1. Writes `deleted_at` and `updated_at` to the local observable entry —
 *      the sync plugin will propagate that update to Postgres.
 *   2. Deletes the key from the local observable map so the UI stops seeing
 *      the record immediately (optimistic removal).
 *
 * The `deleted_at` filter on each collection ensures the row is excluded if it
 * ever comes back from a Realtime or incremental-sync payload.
 *
 * @param collection$ - The synced observable (Record<string, T>).
 * @param id          - The uuid of the row to soft-delete.
 */
export function softDelete<T extends { deleted_at?: string | null; updated_at: string }>(
  collection$: Observable<Record<string, T>>,
  id: string,
): void {
  const now = new Date().toISOString();
  // Step 1: Write the deletion timestamp so the plugin pushes the update to Postgres.
  // Cast to any: Legend-State's Observable<Record<string,T>> does not carry a string
  // index signature at the TS level, but the runtime proxy supports dynamic key access.
  const entry$ = (collection$ as any)[id];
  entry$.set((prev: T) => ({ ...prev, deleted_at: now, updated_at: now }));
  // Step 2: Optimistically remove from the local map so the UI reacts immediately.
  entry$.delete();
}
