/**
 * Session exercises observable.
 *
 * Exercises performed within a workout session, with per-exercise timing
 * and optional superset grouping.
 * Soft-delete supported via deleted_at.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { SessionExerciseRow } from './types';

/**
 * Create the synced session_exercises observable for a specific user.
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createSessionExercisesObservable(uid: string): Observable<Record<string, SessionExerciseRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'session_exercises',
      filter: (select: any) => select.eq('user_id', uid).is('deleted_at', null),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'session_exercises', retrySync: true },
      changesSince: 'last-sync',
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, SessionExerciseRow>>;
}

export type SessionExercisesObservable = ReturnType<typeof createSessionExercisesObservable>;
