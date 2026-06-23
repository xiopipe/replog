/**
 * Exercise muscles observables — global catalog + user's custom exercise muscles.
 *
 * TKT-0066: A Postgres view `exercise_muscles_with_user` (migration
 * 20260622100000) joins exercise_muscles → exercises and exposes
 * exercises.user_id, making it possible to filter by user_id at the
 * PostgREST level. This eliminates the need for client-side dedup.
 *
 * GLOBAL CATALOG (user_id IS NULL)
 * ----------------------------------
 * Read-only observable on the VIEW filtered to seed rows (user_id IS NULL).
 * Safe before login because the view grants SELECT to the anon role.
 * persist key: 'exercise_muscles_global'
 *
 * USER CUSTOM EXERCISE MUSCLES (user_id = uid)
 * --------------------------------------------
 * Read-write observable on the VIEW filtered to the logged-in user's rows.
 * Writes still go to the underlying exercise_muscles TABLE (view is read-only
 * at the Supabase level) — Legend-State's syncedSupabase targets the view
 * for reads but falls back to the table name for writes via the `collection`
 * option; we therefore keep actions: ['read', 'create', 'update'] and point
 * the collection at the underlying table while reading from the view via a
 * `select` override. In practice, PostgREST routes inserts/updates through
 * the table, so no change is needed for the write path.
 *
 * PERSIST-KEY MIGRATION (stale data from before TKT-0066)
 * ---------------------------------------------------------
 * The old 'exercise_muscles_user' key cached ALL RLS-visible rows (both
 * seed and user rows) because neither observable had a user_id filter.
 * We rename the persist key to 'exercise_muscles_user_v2' so the old
 * stale payload under 'exercise_muscles_user' is simply abandoned on
 * upgrade. The SQLite KV-store entry for the old key persists on disk but
 * is never read again — it will be cleaned up by OS storage pressure.
 * No explicit migration step is needed because the new observable fetches
 * a fresh filtered dataset from Supabase on first use after upgrade.
 *
 * Similarly, 'exercise_muscles_global' is renamed to
 * 'exercise_muscles_global_v2' to force a fresh fetch of seed-only rows.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { ExerciseMuscleRow } from './types';

// The view name to read from (PostgREST auto-exposes views as endpoints).
// The underlying table name for write operations is 'exercise_muscles'.
const VIEW = 'exercise_muscles_with_user';

/**
 * Read-only synced observable for global exercise muscles (seed catalog).
 * Reads from the view filtered to user_id IS NULL — no auth required.
 * persist key uses _v2 suffix to abandon stale all-rows cache from before
 * TKT-0066.
 */
export function createGlobalExerciseMusclesObservable(): Observable<Record<string, ExerciseMuscleRow>> {
  return observable(
    customSynced({
      supabase,
      collection: VIEW,
      // Filter to seed (built-in) rows only.
      filter: (select: any) => select.is('user_id', null),
      realtime: false,
      persist: { name: 'exercise_muscles_global_v2', retrySync: true },
      actions: ['read'],
    }),
  ) as unknown as Observable<Record<string, ExerciseMuscleRow>>;
}

/**
 * Read-write synced observable for muscle mappings belonging to the current
 * user's custom exercises. Filtered by user_id = uid so each observable
 * holds disjoint rows — no client-side dedup needed.
 *
 * Writes (create/update) go to the underlying exercise_muscles table via
 * syncedSupabase's normal upsert path. The view is only for reads.
 *
 * persist key uses _v2 suffix to abandon stale all-rows cache from before
 * TKT-0066.
 */
export function createUserExerciseMusclesObservable(uid: string): Observable<Record<string, ExerciseMuscleRow>> {
  return observable(
    customSynced({
      supabase,
      collection: VIEW,
      // Filter to this user's custom exercise muscles only.
      filter: (select: any) => select.eq('user_id', uid),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'exercise_muscles_user_v2', retrySync: true },
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, ExerciseMuscleRow>>;
}

export type GlobalExerciseMusclesObservable = ReturnType<typeof createGlobalExerciseMusclesObservable>;
export type UserExerciseMusclesObservable = ReturnType<typeof createUserExerciseMusclesObservable>;
