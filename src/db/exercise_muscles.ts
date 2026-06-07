/**
 * Exercise muscles observables — global catalog + user's custom exercise muscles.
 *
 * exercise_muscles has NO deleted_at column in the schema.
 * Deletion of a muscle mapping is handled at the DB level via CASCADE from exercises.
 *
 * GLOBAL CATALOG (exercise_id → global exercise with user_id IS NULL)
 * --------------------------------------------------------------------
 * The RLS policy grants read access when the parent exercise is global.
 * We read them all without a user_id filter, relying on RLS + the fact that
 * global exercises have user_id IS NULL. actions: ['read'].
 *
 * USER CUSTOM EXERCISE MUSCLES (exercise's user_id = uid)
 * --------------------------------------------------------
 * Muscles linked to exercises the user created. Full CRUD.
 * There is no user_id column on exercise_muscles itself; we join/filter via
 * the exercise_id. Because Legend-State filters are applied as PostgREST
 * query params, we use a direct filter on the exercise_id set owned by the
 * user. In practice the RLS policy already restricts writes; the filter here
 * is for the sync scope.
 *
 * NOTE: Because exercise_muscles has no user_id column, the realtime filter
 * cannot be `user_id=eq.${uid}`. We leave realtime enabled without a column
 * filter — RLS ensures only visible rows are delivered. This is safe but means
 * all RLS-visible exercise_muscles trigger the subscription. For MVP scale this
 * is fine.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { ExerciseMuscleRow } from './types';

/**
 * Read-only synced observable for global exercise muscles (catalog).
 * Safe to call without a uid.
 */
export function createGlobalExerciseMusclesObservable(): Observable<Record<string, ExerciseMuscleRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'exercise_muscles',
      // No column filter here — RLS limits to readable rows (global + own exercises).
      // We persist all readable muscle mappings so the catalog works offline.
      realtime: false,
      persist: { name: 'exercise_muscles_global', retrySync: true },
      changesSince: 'last-sync',
      actions: ['read'],
    }),
  ) as unknown as Observable<Record<string, ExerciseMuscleRow>>;
}

/**
 * Read-write synced observable for muscle mappings that belong to exercises
 * owned by the current user. Call from `createUserObservables(uid)`.
 *
 * The filter uses an RPC-style subquery isn't available in PostgREST filter
 * chaining, so we rely on RLS to scope writes, and sync all readable rows.
 * On small catalogs this is fine. If the catalog grows large, replace with
 * a Postgres view that joins exercise_muscles → exercises and exposes user_id.
 */
export function createUserExerciseMusclesObservable(_uid: string): Observable<Record<string, ExerciseMuscleRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'exercise_muscles',
      // No extra column filter — RLS restricts to rows the user can read/write.
      // The `_uid` param is accepted for API consistency; keep it for future
      // use if a view exposing user_id is added.
      realtime: true, // RLS-scoped; no column filter needed
      persist: { name: 'exercise_muscles_user', retrySync: true },
      changesSince: 'last-sync',
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, ExerciseMuscleRow>>;
}

export type GlobalExerciseMusclesObservable = ReturnType<typeof createGlobalExerciseMusclesObservable>;
export type UserExerciseMusclesObservable = ReturnType<typeof createUserExerciseMusclesObservable>;
