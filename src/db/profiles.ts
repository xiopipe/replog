/**
 * Profiles observable.
 *
 * One profile per user (id = auth.uid). The PK is the user's uuid,
 * so this collection is keyed by that same id.
 *
 * profiles has no deleted_at column, so no soft-delete filter is needed.
 * RLS ensures users only see their own row.
 */

import { type Observable, observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { customSynced } from './sync';
import type { ProfileRow } from './types';

/**
 * Create the synced profiles observable for a specific user.
 * Call once from `createUserObservables(uid)` after auth is confirmed.
 *
 * Returns an observable Record<id, ProfileRow> — in practice it will always
 * contain at most one key (the current user's profile).
 */
export function createProfilesObservable(uid: string): Observable<Record<string, ProfileRow>> {
  // Without Supabase-generated DB types the syncedSupabase filter callback infers
  // `select` as PostgrestFilterBuilder<any, any, any[], ...>, so `.eq()` would fail
  // typecheck. Annotating `select: any` resolves it. The outer cast to
  // `Observable<Record<string, ProfileRow>>` bridges the wide internal union that
  // customSynced returns when no schema is provided.
  return observable(
    customSynced({
      supabase,
      collection: 'profiles',
      filter: (select: any) => select.eq('id', uid),
      realtime: { filter: `id=eq.${uid}` },
      persist: { name: 'profiles', retrySync: true },
      actions: ['read', 'create', 'update'],
    }),
  ) as unknown as Observable<Record<string, ProfileRow>>;
}

export type ProfilesObservable = ReturnType<typeof createProfilesObservable>;
