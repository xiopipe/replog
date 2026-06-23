/**
 * Tests for favoritesRecents pure helpers (TKT-0039).
 * Node-only: no RN/Expo imports.
 */

import {
  getFavoriteExerciseIds,
  findFavoriteRow,
  buildFavoriteRow,
  getRecentExerciseIds,
  filterExerciseIdsByFilters,
} from '../favoritesRecents';
import type { ExerciseFavoriteRow, SessionExerciseRow, WorkoutSessionRow, ExerciseRow, ExerciseMuscleRow } from '@/db';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFav(id: string, userId: string, exerciseId: string): ExerciseFavoriteRow {
  return { id, user_id: userId, exercise_id: exerciseId, created_at: '2026-01-01T00:00:00Z' };
}

function makeSE(id: string, exerciseId: string, sessionId: string, deletedAt?: string): SessionExerciseRow {
  return {
    id,
    user_id: 'u1',
    session_id: sessionId,
    exercise_id: exerciseId,
    order_index: 0,
    started_at: null,
    ended_at: null,
    superset_group: null,
    superset_order: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: deletedAt ?? null,
  };
}

function makeSession(id: string, startedAt: string, deletedAt?: string): WorkoutSessionRow {
  return {
    id,
    user_id: 'u1',
    routine_id: null,
    name: null,
    started_at: startedAt,
    ended_at: null,
    accumulated_active_seconds: 0,
    status: 'completed',
    notes: null,
    created_at: startedAt,
    updated_at: startedAt,
    deleted_at: deletedAt ?? null,
  };
}

function makeExercise(id: string, category: ExerciseRow['category'] = 'barbell'): ExerciseRow {
  return {
    id,
    user_id: null,
    name: id,
    category,
    is_custom: false,
    is_bodyweight: false,
    instructions: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  };
}

function makeMuscle(id: string, exerciseId: string, muscle: ExerciseMuscleRow['muscle']): ExerciseMuscleRow {
  return {
    id,
    exercise_id: exerciseId,
    muscle,
    role: 'primary',
    contribution: 1.0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// getFavoriteExerciseIds
// ---------------------------------------------------------------------------

describe('getFavoriteExerciseIds', () => {
  it('returns empty set when no favorites', () => {
    expect(getFavoriteExerciseIds({})).toEqual(new Set());
  });

  it('returns the exercise ids from the favorites map', () => {
    const favs = {
      'fav-1': makeFav('fav-1', 'u1', 'ex-a'),
      'fav-2': makeFav('fav-2', 'u1', 'ex-b'),
    };
    expect(getFavoriteExerciseIds(favs)).toEqual(new Set(['ex-a', 'ex-b']));
  });
});

// ---------------------------------------------------------------------------
// findFavoriteRow
// ---------------------------------------------------------------------------

describe('findFavoriteRow', () => {
  it('returns null when exercise is not favorited', () => {
    const favs = { 'fav-1': makeFav('fav-1', 'u1', 'ex-a') };
    expect(findFavoriteRow(favs, 'ex-b')).toBeNull();
  });

  it('returns the matching favorite row', () => {
    const fav = makeFav('fav-1', 'u1', 'ex-a');
    const favs = { 'fav-1': fav };
    expect(findFavoriteRow(favs, 'ex-a')).toEqual(fav);
  });
});

// ---------------------------------------------------------------------------
// buildFavoriteRow
// ---------------------------------------------------------------------------

describe('buildFavoriteRow', () => {
  it('builds a favorite row with the given user, exercise, and supplied id', () => {
    const row = buildFavoriteRow('user-1', 'ex-x', 'supplied-id');
    expect(row.user_id).toBe('user-1');
    expect(row.exercise_id).toBe('ex-x');
    expect(row.id).toBe('supplied-id');
    expect(typeof row.created_at).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// getRecentExerciseIds
// ---------------------------------------------------------------------------

describe('getRecentExerciseIds', () => {
  it('returns empty when no session exercises', () => {
    expect(getRecentExerciseIds({}, {})).toEqual([]);
  });

  it('returns exercise ids ordered by most-recent session', () => {
    const sessions = {
      's1': makeSession('s1', '2026-01-01T10:00:00Z'),
      's2': makeSession('s2', '2026-01-05T10:00:00Z'),
      's3': makeSession('s3', '2026-01-03T10:00:00Z'),
    };
    const ses = {
      'se1': makeSE('se1', 'ex-a', 's1'),
      'se2': makeSE('se2', 'ex-b', 's2'),
      'se3': makeSE('se3', 'ex-c', 's3'),
    };
    const result = getRecentExerciseIds(ses, sessions);
    expect(result).toEqual(['ex-b', 'ex-c', 'ex-a']);
  });

  it('deduplicates exercise ids keeping most recent occurrence', () => {
    const sessions = {
      's1': makeSession('s1', '2026-01-01T10:00:00Z'),
      's2': makeSession('s2', '2026-01-10T10:00:00Z'),
    };
    const ses = {
      'se1': makeSE('se1', 'ex-a', 's1'),
      'se2': makeSE('se2', 'ex-a', 's2'), // same exercise, newer session
    };
    const result = getRecentExerciseIds(ses, sessions);
    expect(result).toEqual(['ex-a']);
    expect(result.length).toBe(1);
  });

  it('respects the limit', () => {
    const sessions: Record<string, WorkoutSessionRow> = {};
    const ses: Record<string, SessionExerciseRow> = {};
    for (let i = 0; i < 10; i++) {
      const sId = `s${i}`;
      const seId = `se${i}`;
      sessions[sId] = makeSession(sId, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`);
      ses[seId] = makeSE(seId, `ex-${i}`, sId);
    }
    expect(getRecentExerciseIds(ses, sessions, 5)).toHaveLength(5);
  });

  it('excludes soft-deleted session_exercises', () => {
    const sessions = { 's1': makeSession('s1', '2026-01-01T10:00:00Z') };
    const ses = { 'se1': makeSE('se1', 'ex-a', 's1', '2026-01-02T00:00:00Z') };
    expect(getRecentExerciseIds(ses, sessions)).toEqual([]);
  });

  it('excludes exercises from soft-deleted sessions', () => {
    const sessions = { 's1': makeSession('s1', '2026-01-01T10:00:00Z', '2026-01-02T00:00:00Z') };
    const ses = { 'se1': makeSE('se1', 'ex-a', 's1') };
    expect(getRecentExerciseIds(ses, sessions)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterExerciseIdsByFilters
// ---------------------------------------------------------------------------

describe('filterExerciseIdsByFilters', () => {
  const exercises: Record<string, ExerciseRow> = {
    'ex-a': makeExercise('ex-a', 'barbell'),
    'ex-b': makeExercise('ex-b', 'dumbbell'),
    'ex-c': makeExercise('ex-c', 'barbell'),
  };
  const muscles: Record<string, ExerciseMuscleRow> = {
    'm1': makeMuscle('m1', 'ex-a', 'chest'),
    'm2': makeMuscle('m2', 'ex-b', 'back'),
    'm3': makeMuscle('m3', 'ex-c', 'chest'),
  };

  it('returns all ids when no filters active', () => {
    expect(filterExerciseIdsByFilters(['ex-a', 'ex-b'], exercises, muscles, null, null))
      .toEqual(['ex-a', 'ex-b']);
  });

  it('filters by equipment', () => {
    expect(filterExerciseIdsByFilters(['ex-a', 'ex-b', 'ex-c'], exercises, muscles, null, 'barbell'))
      .toEqual(['ex-a', 'ex-c']);
  });

  it('filters by muscle', () => {
    expect(filterExerciseIdsByFilters(['ex-a', 'ex-b', 'ex-c'], exercises, muscles, 'chest', null))
      .toEqual(['ex-a', 'ex-c']);
  });

  it('applies both filters with AND logic', () => {
    expect(filterExerciseIdsByFilters(['ex-a', 'ex-b', 'ex-c'], exercises, muscles, 'chest', 'dumbbell'))
      .toEqual([]);
    expect(filterExerciseIdsByFilters(['ex-a', 'ex-b', 'ex-c'], exercises, muscles, 'chest', 'barbell'))
      .toEqual(['ex-a', 'ex-c']);
  });
});
