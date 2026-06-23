/**
 * Tests for the pure re-key logic (no RN/expo imports — runs in node env).
 *
 * Covers:
 *   - rekeyRows: row transform + table ordering validation
 *   - getAuthVariant / isAnonymous: anonymous detection helper
 *   - getSettingsAccountState: settings CTA/sign-out variant logic
 */

import {
  rekeyRows,
  extractLocalProfile,
  TABLE_REKEY_ORDER,
  getAuthVariant,
  getSettingsAccountState,
  type AuthVariant,
} from './rekey';

// ---------------------------------------------------------------------------
// rekeyRows
// ---------------------------------------------------------------------------

describe('rekeyRows', () => {
  const LOCAL_UID = 'local-uuid-1234';
  const CLOUD_UID = 'cloud-uuid-5678';

  it('replaces user_id from oldUid to newUid', () => {
    const rows = [
      { id: 'r1', user_id: LOCAL_UID, name: 'Push Day', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'r2', user_id: LOCAL_UID, name: 'Pull Day', updated_at: '2026-01-01T00:00:00Z' },
    ];

    const result = rekeyRows(rows, LOCAL_UID, CLOUD_UID);

    expect(result).toHaveLength(2);
    expect(result[0].user_id).toBe(CLOUD_UID);
    expect(result[1].user_id).toBe(CLOUD_UID);
  });

  it('does not mutate the original rows', () => {
    const rows = [
      { id: 'r1', user_id: LOCAL_UID, updated_at: '2026-01-01T00:00:00Z' },
    ];
    rekeyRows(rows, LOCAL_UID, CLOUD_UID);
    expect(rows[0].user_id).toBe(LOCAL_UID);
  });

  it('updates updated_at to a new ISO timestamp', () => {
    const before = '2026-01-01T00:00:00.000Z';
    const rows = [
      { id: 'r1', user_id: LOCAL_UID, updated_at: before },
    ];
    const result = rekeyRows(rows, LOCAL_UID, CLOUD_UID);
    // updated_at must change
    expect(result[0].updated_at).not.toBe(before);
    // must be a valid ISO string
    expect(new Date(result[0].updated_at!).toISOString()).toBeTruthy();
  });

  it('skips rows that do not belong to oldUid', () => {
    const OTHER_UID = 'other-uuid';
    const rows = [
      { id: 'r1', user_id: LOCAL_UID, updated_at: '2026-01-01T00:00:00Z' },
      { id: 'r2', user_id: OTHER_UID, updated_at: '2026-01-01T00:00:00Z' },
    ];
    const result = rekeyRows(rows, LOCAL_UID, CLOUD_UID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('returns empty array when input is empty', () => {
    const result = rekeyRows([], LOCAL_UID, CLOUD_UID);
    expect(result).toEqual([]);
  });

  it('works on rows without updated_at (exercise_favorites has no updated_at)', () => {
    const rows = [
      { id: 'f1', user_id: LOCAL_UID, exercise_id: 'ex1', created_at: '2026-01-01T00:00:00Z' },
    ] as any[];
    const result = rekeyRows(rows, LOCAL_UID, CLOUD_UID);
    expect(result[0].user_id).toBe(CLOUD_UID);
    // updated_at not added when not present originally
    expect('updated_at' in result[0]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractLocalProfile
// ---------------------------------------------------------------------------

describe('extractLocalProfile', () => {
  const LOCAL_UID = 'local-uuid-1234';

  it('returns the profile row with id matching localUid', () => {
    const rows = [
      { id: LOCAL_UID, display_name: null, unit_preference: 'kg' },
      { id: 'other-uid', display_name: 'Alice', unit_preference: 'lb' },
    ];
    const result = extractLocalProfile(rows, LOCAL_UID);
    expect(result?.id).toBe(LOCAL_UID);
  });

  it('returns null when no profile matches', () => {
    const result = extractLocalProfile([], LOCAL_UID);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TABLE_REKEY_ORDER — parent-before-child invariant
// ---------------------------------------------------------------------------

describe('TABLE_REKEY_ORDER', () => {
  const order = TABLE_REKEY_ORDER;

  function indexOf(table: string): number {
    return order.indexOf(table as any);
  }

  it('places routines before routine_exercises', () => {
    expect(indexOf('routines')).toBeLessThan(indexOf('routine_exercises'));
  });

  it('places plans before plan_days', () => {
    expect(indexOf('plans')).toBeLessThan(indexOf('plan_days'));
  });

  it('places workout_sessions before session_exercises', () => {
    expect(indexOf('workout_sessions')).toBeLessThan(indexOf('session_exercises'));
  });

  it('places session_exercises before sets', () => {
    expect(indexOf('session_exercises')).toBeLessThan(indexOf('sets'));
  });

  it('contains all expected tables', () => {
    const expected = [
      'routines',
      'routine_exercises',
      'plans',
      'plan_days',
      'workout_sessions',
      'session_exercises',
      'sets',
      'user_exercises',
      'user_exercise_muscles',
      'exercise_favorites',
    ];
    for (const t of expected) {
      expect(order).toContain(t);
    }
  });
});

// ---------------------------------------------------------------------------
// isAnonymous helper (inline — same logic as auth.tsx)
// ---------------------------------------------------------------------------

function isAnonymous(user: { app_metadata?: { is_anonymous?: boolean } } | null): boolean {
  return user?.app_metadata?.is_anonymous === true;
}

describe('isAnonymous', () => {
  it('returns true when app_metadata.is_anonymous is true', () => {
    expect(isAnonymous({ app_metadata: { is_anonymous: true } })).toBe(true);
  });

  it('returns false when app_metadata.is_anonymous is false', () => {
    expect(isAnonymous({ app_metadata: { is_anonymous: false } })).toBe(false);
  });

  it('returns false when app_metadata is missing', () => {
    expect(isAnonymous({ app_metadata: {} })).toBe(false);
  });

  it('returns false for a null user', () => {
    expect(isAnonymous(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAuthVariant
// ---------------------------------------------------------------------------

describe('getAuthVariant', () => {
  it('returns local-only when no cloud session', () => {
    expect(getAuthVariant(false, false)).toBe('local-only');
    expect(getAuthVariant(false, true)).toBe('local-only');
  });

  it('returns anonymous when cloud session exists and user is anonymous', () => {
    expect(getAuthVariant(true, true)).toBe('anonymous');
  });

  it('returns permanent when cloud session exists and user is not anonymous', () => {
    expect(getAuthVariant(true, false)).toBe('permanent');
  });
});

// ---------------------------------------------------------------------------
// getSettingsAccountState
// ---------------------------------------------------------------------------

describe('getSettingsAccountState (criteria 10, 11, 13, 14)', () => {
  it('local-only: shows adoption CTA, hides sign-out', () => {
    const state = getSettingsAccountState('local-only');
    expect(state.showCloudAdoptionCta).toBe(true);
    expect(state.showSignOut).toBe(false);
    expect(state.requireSignOutConfirmation).toBe(false);
  });

  it('anonymous: shows adoption CTA, shows sign-out with confirmation warning', () => {
    const state = getSettingsAccountState('anonymous');
    expect(state.showCloudAdoptionCta).toBe(true);
    expect(state.showSignOut).toBe(true);
    expect(state.requireSignOutConfirmation).toBe(true);
  });

  it('permanent: hides adoption CTA, shows sign-out without warning', () => {
    const state = getSettingsAccountState('permanent');
    expect(state.showCloudAdoptionCta).toBe(false);
    expect(state.showSignOut).toBe(true);
    expect(state.requireSignOutConfirmation).toBe(false);
  });

  const variants: AuthVariant[] = ['local-only', 'anonymous', 'permanent'];
  it.each(variants)('is exhaustive for variant %s', (v) => {
    const s = getSettingsAccountState(v);
    expect(typeof s.showCloudAdoptionCta).toBe('boolean');
    expect(typeof s.showSignOut).toBe('boolean');
    expect(typeof s.requireSignOutConfirmation).toBe('boolean');
  });
});
