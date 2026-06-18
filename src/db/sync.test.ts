import { observable } from '@legendapp/state';

// sync.ts pulls in native modules at load time; the jest env is pure-logic only.
// Stub them so softDelete (a pure observable write) can be imported and tested.
jest.mock('expo-sqlite/kv-store', () => ({}));
jest.mock('@legendapp/state/persist-plugins/expo-sqlite', () => ({
  observablePersistSqlite: () => ({}),
}));
jest.mock('@legendapp/state/sync-plugins/supabase', () => ({
  configureSyncedSupabase: () => undefined,
  syncedSupabase: () => ({}),
}));
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { softDelete } from './sync';

describe('softDelete (TKT-0008)', () => {
  it('sets deleted_at and updated_at but keeps the local key', () => {
    const col$ = observable<Record<string, { deleted_at?: string | null; updated_at: string }>>(
      { a: { deleted_at: null, updated_at: '2026-01-01T00:00:00.000Z' } },
    );

    softDelete(col$, 'a');

    const row = col$.a.get();
    // Key must remain so the debounced push can flush the deleted_at UPDATE to
    // Postgres before the row is dropped (removing it in-tick raced the push).
    expect(row).toBeDefined();
    expect(row.deleted_at).toEqual(expect.any(String));
    expect(row.updated_at).toBe(row.deleted_at);
  });
});
