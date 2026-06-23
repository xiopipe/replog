/**
 * Exercise favorites observable (TKT-0039).
 *
 * Stores user-scoped favorite exercise references in `exercise_favorites`.
 * Full CRUD (create + read; delete via deleteById — no soft-delete because
 * the table has no deleted_at; toggling off means a hard DELETE on the row).
 *
 * Because syncedSupabase only exposes 'delete' as an action that maps to
 * deleting the local key, and our sync config intentionally avoids hard DELETE
 * actions on other tables, we model un-favorite as: remove the local key and
 * let the sync plugin propagate the delete to Postgres.
 * The exercise_favorites table has no children and no soft-delete requirement,
 * so hard deletes are safe.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { ExerciseFavoriteRow } from './types';

/**
 * Create the synced exercise favorites observable for a specific user.
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createExerciseFavoritesObservable(
  uid: string,
): Observable<Record<string, ExerciseFavoriteRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'exercise_favorites',
      filter: (select: any) => select.eq('user_id', uid),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'exercise_favorites', retrySync: true },
      // Include 'delete' so toggling off propagates a real DELETE to Postgres.
      actions: ['read', 'create', 'delete'],
    }),
  ) as unknown as Observable<Record<string, ExerciseFavoriteRow>>;
}

export type ExerciseFavoritesObservable = ReturnType<typeof createExerciseFavoritesObservable>;
