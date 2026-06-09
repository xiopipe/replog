/**
 * Plans observable.
 *
 * A plan is a weekly training split. MVP: one active plan per user.
 * Soft-delete supported via deleted_at.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { PlanRow } from './types';

/**
 * Create the synced plans observable for a specific user.
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createPlansObservable(uid: string): Observable<Record<string, PlanRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'plans',
      filter: (select: any) => select.eq('user_id', uid).is('deleted_at', null),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'plans', retrySync: true },
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, PlanRow>>;
}

export type PlansObservable = ReturnType<typeof createPlansObservable>;
