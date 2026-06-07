/**
 * Workout sessions observable.
 *
 * An actual training session. started_at is editable for retroactive logging.
 * status transitions: 'in_progress' → 'completed'.
 * Soft-delete supported via deleted_at.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { WorkoutSessionRow } from './types';

/**
 * Create the synced workout_sessions observable for a specific user.
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createWorkoutSessionsObservable(uid: string): Observable<Record<string, WorkoutSessionRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'workout_sessions',
      filter: (select: any) => select.eq('user_id', uid).is('deleted_at', null),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'workout_sessions', retrySync: true },
      changesSince: 'last-sync',
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, WorkoutSessionRow>>;
}

export type WorkoutSessionsObservable = ReturnType<typeof createWorkoutSessionsObservable>;
