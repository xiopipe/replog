/**
 * Routines observable.
 *
 * A routine is a single day's exercise sequence (e.g., "Chest Day").
 * Soft-delete supported via deleted_at; filter excludes deleted rows.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { RoutineRow } from './types';

/**
 * Create the synced routines observable for a specific user.
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createRoutinesObservable(uid: string): Observable<Record<string, RoutineRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'routines',
      filter: (select: any) => select.eq('user_id', uid).is('deleted_at', null),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'routines', retrySync: true },
      changesSince: 'last-sync',
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, RoutineRow>>;
}

export type RoutinesObservable = ReturnType<typeof createRoutinesObservable>;
