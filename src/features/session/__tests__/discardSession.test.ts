/* eslint-disable import/first -- jest.mock calls must precede imports */
/**
 * Tests for discardSession + isSessionStale — TKT-0049.
 * Pure node environment — no RN or Legend-State imports.
 */

// Mock Legend-State and native modules (same pattern as sync.test.ts)
jest.mock('expo-sqlite/kv-store', () => ({}));
jest.mock('@legendapp/state/persist-plugins/expo-sqlite', () => ({
  observablePersistSqlite: () => ({}),
}));
jest.mock('@legendapp/state/sync-plugins/supabase', () => ({
  configureSyncedSupabase: () => undefined,
  syncedSupabase: () => ({}),
}));
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { isSessionStale, STALE_SESSION_THRESHOLD_HOURS } from '../activeTime';
import { discardSession } from '../discardSession';

describe('isSessionStale', () => {
  it('returns false when session started recently', () => {
    const now = new Date();
    const recentIso = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // 30 min ago
    expect(isSessionStale(recentIso, now.getTime())).toBe(false);
  });

  it('returns true when session started more than threshold hours ago', () => {
    const now = new Date();
    const staleIso = new Date(
      now.getTime() - (STALE_SESSION_THRESHOLD_HOURS + 1) * 60 * 60 * 1000,
    ).toISOString();
    expect(isSessionStale(staleIso, now.getTime())).toBe(true);
  });

  it('returns false for null lastActiveIso', () => {
    expect(isSessionStale(null, Date.now())).toBe(false);
  });

  it('uses exactly 4h threshold', () => {
    expect(STALE_SESSION_THRESHOLD_HOURS).toBe(4);
  });
});

describe('discardSession batch logic', () => {
  it('soft-deletes session, session_exercises, and sets in one batch', () => {
    // Build a minimal observable mock that records set() calls.
    const calls: Record<string, unknown> = {};

    function makeProxy(collectionName: string) {
      return new Proxy(
        {},
        {
          get(_target, id: string) {
            if (id === 'peek' || id === 'get') {
              // Return a snapshot function
              if (collectionName === 'workoutSessions') {
                return () => ({
                  'session-1': {
                    id: 'session-1',
                    status: 'in_progress',
                    deleted_at: null,
                    updated_at: '2026-01-01T00:00:00.000Z',
                  },
                });
              }
              if (collectionName === 'sessionExercises') {
                return () => ({
                  'se-1': {
                    id: 'se-1',
                    session_id: 'session-1',
                    deleted_at: null,
                    updated_at: '2026-01-01T00:00:00.000Z',
                  },
                  'se-2': {
                    id: 'se-2',
                    session_id: 'other-session',
                    deleted_at: null,
                    updated_at: '2026-01-01T00:00:00.000Z',
                  },
                });
              }
              if (collectionName === 'sets') {
                return () => ({
                  'set-1': {
                    id: 'set-1',
                    session_exercise_id: 'se-1',
                    deleted_at: null,
                    updated_at: '2026-01-01T00:00:00.000Z',
                  },
                  'set-2': {
                    id: 'set-2',
                    session_exercise_id: 'se-2', // different session
                    deleted_at: null,
                    updated_at: '2026-01-01T00:00:00.000Z',
                  },
                });
              }
              return () => ({});
            }
            // Return a record proxy for [id].set()
            return {
              set(updater: (prev: unknown) => unknown) {
                const key = `${collectionName}.${id}`;
                const prev = { deleted_at: null, updated_at: '2026-01-01T00:00:00.000Z' };
                calls[key] = updater(prev);
              },
            };
          },
        },
      );
    }

    const mockDb = {
      workoutSessions$: makeProxy('workoutSessions'),
      sessionExercises$: makeProxy('sessionExercises'),
      sets$: makeProxy('sets'),
    } as any;

    // Run discardSession
    discardSession(mockDb, 'session-1');

    // The session itself should be soft-deleted
    expect((calls['workoutSessions.session-1'] as any).deleted_at).toBeTruthy();
    expect((calls['workoutSessions.session-1'] as any).updated_at).toBeTruthy();

    // se-1 belongs to session-1 → should be deleted
    expect((calls['sessionExercises.se-1'] as any).deleted_at).toBeTruthy();

    // se-2 belongs to other-session → must NOT be touched
    expect(calls['sessionExercises.se-2']).toBeUndefined();

    // set-1 belongs to se-1 (session-1) → should be deleted
    expect((calls['sets.set-1'] as any).deleted_at).toBeTruthy();

    // set-2 belongs to se-2 (other session) → must NOT be touched
    expect(calls['sets.set-2']).toBeUndefined();
  });
});
