/**
 * Plan days observable.
 *
 * Links routines to a plan, with an optional fixed weekday.
 * weekday=null means a flexible/floating day.
 * Soft-delete supported via deleted_at.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { PlanDayRow } from './types';

/**
 * Create the synced plan_days observable for a specific user.
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createPlanDaysObservable(uid: string): Observable<Record<string, PlanDayRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'plan_days',
      filter: (select: any) => select.eq('user_id', uid).is('deleted_at', null),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'plan_days', retrySync: true },
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, PlanDayRow>>;
}

export type PlanDaysObservable = ReturnType<typeof createPlanDaysObservable>;
