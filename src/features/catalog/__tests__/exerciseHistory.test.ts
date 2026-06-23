/**
 * Tests for exerciseHistory pure helpers (TKT-0040).
 * Node-only: no RN/Expo imports.
 */

import { buildExerciseHistorySessions, bestEstimated1RM } from '../exerciseHistory';
import type { SetRow, SessionExerciseRow } from '@/db';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let _setIdx = 0;

function makeSet(
  id: string,
  seId: string,
  weightKg: number,
  reps: number,
  performedAt: string,
): SetRow {
  return {
    id,
    user_id: 'u1',
    session_exercise_id: seId,
    set_index: _setIdx++,
    weight_value: weightKg,
    weight_unit: 'kg',
    weight_kg: weightKg,
    reps,
    failure_metric: 'rir',
    rir: 2,
    rpe: null,
    is_warmup: false,
    reached_failure: false,
    rest_seconds: null,
    drop_group: null,
    drop_order: null,
    performed_at: performedAt,
    metadata: {},
    created_at: performedAt,
    updated_at: performedAt,
    deleted_at: null,
  };
}

function makeSE(id: string, sessionId: string, exerciseId = 'ex-a'): SessionExerciseRow {
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
    deleted_at: null,
  };
}

// ---------------------------------------------------------------------------
// buildExerciseHistorySessions
// ---------------------------------------------------------------------------

describe('buildExerciseHistorySessions', () => {
  beforeEach(() => { _setIdx = 0; });

  it('returns empty array when no sets', () => {
    expect(buildExerciseHistorySessions([], {}, {})).toEqual([]);
  });

  it('groups sets by session and sorts descending by startedAt', () => {
    const se1 = makeSE('se1', 's1');
    const se2 = makeSE('se2', 's2');
    const sessions = {
      's1': { started_at: '2026-01-01T10:00:00Z' },
      's2': { started_at: '2026-01-10T10:00:00Z' },
    };
    const set1 = makeSet('set1', 'se1', 100, 5, '2026-01-01T10:00:00Z');
    const set2 = makeSet('set2', 'se2', 110, 5, '2026-01-10T10:00:00Z');

    const result = buildExerciseHistorySessions([set1, set2], { se1, se2 }, sessions);
    expect(result).toHaveLength(2);
    // Most recent first
    expect(result[0]!.sessionId).toBe('s2');
    expect(result[1]!.sessionId).toBe('s1');
  });

  it('marks the first-ever set as a PR (no prior history)', () => {
    const se1 = makeSE('se1', 's1');
    const sessions = { 's1': { started_at: '2026-01-01T10:00:00Z' } };
    const set1 = makeSet('set1', 'se1', 100, 5, '2026-01-01T10:00:00Z');

    const result = buildExerciseHistorySessions([set1], { se1 }, sessions);
    expect(result[0]!.sets[0]!.isPR).toBe(true);
  });

  it('marks a set as PR only when it beats prior sessions', () => {
    const se1 = makeSE('se1', 's1');
    const se2 = makeSE('se2', 's2');
    const sessions = {
      's1': { started_at: '2026-01-01T10:00:00Z' },
      's2': { started_at: '2026-01-10T10:00:00Z' },
    };
    // s1: 100 kg × 5, s2: 90 kg × 5 (regression — NOT a PR)
    const set1 = makeSet('set1', 'se1', 100, 5, '2026-01-01T10:00:00Z');
    const set2 = makeSet('set2', 'se2', 90, 5, '2026-01-10T10:00:00Z');

    const result = buildExerciseHistorySessions([set1, set2], { se1, se2 }, sessions);

    // s1 (older, now at index 1) — first ever, IS a PR
    const s1Result = result.find((r) => r.sessionId === 's1')!;
    expect(s1Result.sets[0]!.isPR).toBe(true);

    // s2 (newer, index 0) — 90kg < 100kg, NOT a PR
    const s2Result = result.find((r) => r.sessionId === 's2')!;
    expect(s2Result.sets[0]!.isPR).toBe(false);
  });

  it('marks a set as PR when it sets a new high', () => {
    const se1 = makeSE('se1', 's1');
    const se2 = makeSE('se2', 's2');
    const sessions = {
      's1': { started_at: '2026-01-01T10:00:00Z' },
      's2': { started_at: '2026-01-10T10:00:00Z' },
    };
    const set1 = makeSet('set1', 'se1', 100, 5, '2026-01-01T10:00:00Z');
    const set2 = makeSet('set2', 'se2', 110, 5, '2026-01-10T10:00:00Z');

    const result = buildExerciseHistorySessions([set1, set2], { se1, se2 }, sessions);
    const s2Result = result.find((r) => r.sessionId === 's2')!;
    expect(s2Result.sets[0]!.isPR).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// bestEstimated1RM
// ---------------------------------------------------------------------------

describe('bestEstimated1RM', () => {
  beforeEach(() => { _setIdx = 0; });

  it('returns null for empty set list', () => {
    expect(bestEstimated1RM([])).toBeNull();
  });

  it('returns null when no sets have valid weight/reps', () => {
    const s = makeSet('s1', 'se1', 0, 0, '2026-01-01T00:00:00Z');
    s.weight_kg = null;
    expect(bestEstimated1RM([s])).toBeNull();
  });

  it('returns the best e1RM across sets', () => {
    const s1 = makeSet('s1', 'se1', 100, 5, '2026-01-01T00:00:00Z');
    const s2 = makeSet('s2', 'se1', 110, 3, '2026-01-01T00:00:00Z');
    const result = bestEstimated1RM([s1, s2]);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });
});
