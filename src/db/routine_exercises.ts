/**
 * Routine exercises observable.
 *
 * Links exercises to routines with an order index and optional training targets.
 * Soft-delete supported via deleted_at.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { RoutineExerciseRow } from './types';

/**
 * Create the synced routine_exercises observable for a specific user.
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createRoutineExercisesObservable(uid: string): Observable<Record<string, RoutineExerciseRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'routine_exercises',
      filter: (select: any) => select.eq('user_id', uid).is('deleted_at', null),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'routine_exercises', retrySync: true },
      changesSince: 'last-sync',
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, RoutineExerciseRow>>;
}

export type RoutineExercisesObservable = ReturnType<typeof createRoutineExercisesObservable>;
