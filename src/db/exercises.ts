/**
 * Exercises observables — global catalog + user's custom exercises.
 *
 * GLOBAL CATALOG (user_id IS NULL)
 * ---------------------------------
 * Predefined exercises seeded in Supabase (02_seed_exercises.sql).
 * These are READ-ONLY from the client. We never push writes for them.
 * actions: ['read'] — no create/update/delete.
 * No deleted_at filter needed: seed data is never soft-deleted.
 *
 * USER CUSTOM EXERCISES (user_id = uid)
 * --------------------------------------
 * Exercises created by this specific user.
 * Full CRUD actions (minus hard delete — we use softDelete helper).
 * Filter excludes soft-deleted rows via .is('deleted_at', null).
 *
 * The two observables are kept separate so callers can clearly distinguish
 * read-only catalog data from mutable user data.
 * To show a combined list in the UI, merge them:
 *   [...Object.values(globalExercises$.get()), ...Object.values(userExercises$.get())]
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { ExerciseRow } from './types';

/**
 * Read-only synced observable for the global predefined exercise catalog
 * (rows where user_id IS NULL). Safe to call without a uid — shared data.
 */
export function createGlobalExercisesObservable(): Observable<Record<string, ExerciseRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'exercises',
      filter: (select: any) => select.is('user_id', null),
      realtime: false, // global catalog changes only via DB migrations; no realtime needed
      persist: { name: 'exercises_global', retrySync: true },
      actions: ['read'],
    }),
  ) as unknown as Observable<Record<string, ExerciseRow>>;
}

/**
 * Read-write synced observable for the current user's custom exercises
 * (rows where user_id = uid and deleted_at IS NULL).
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createUserExercisesObservable(uid: string): Observable<Record<string, ExerciseRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'exercises',
      filter: (select: any) => select.eq('user_id', uid).is('deleted_at', null),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'exercises_user', retrySync: true },
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, ExerciseRow>>;
}

export type GlobalExercisesObservable = ReturnType<typeof createGlobalExercisesObservable>;
export type UserExercisesObservable = ReturnType<typeof createUserExercisesObservable>;
