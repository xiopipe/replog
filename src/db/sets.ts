/**
 * Sets observable.
 *
 * The granular per-set record — the core data unit of the app.
 * Weight uses dual storage: weight_value + weight_unit (what was typed) and
 * weight_kg (normalized for analytics). See Architecture.md §Data model.
 * is_warmup=true rows are excluded from PR/volume calculations (business logic
 * layer — not enforced here).
 * Soft-delete supported via deleted_at.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { SetRow } from './types';

/**
 * Create the synced sets observable for a specific user.
 * Call from `createUserObservables(uid)` after auth is confirmed.
 */
export function createSetsObservable(uid: string): Observable<Record<string, SetRow>> {
  return observable(
    customSynced({
      supabase,
      collection: 'sets',
      filter: (select: any) => select.eq('user_id', uid).is('deleted_at', null),
      realtime: { filter: `user_id=eq.${uid}` },
      persist: { name: 'sets', retrySync: true },
      changesSince: 'last-sync',
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, SetRow>>;
}

export type SetsObservable = ReturnType<typeof createSetsObservable>;
