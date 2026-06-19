/**
 * Unit tests for src/features/session/queries.ts
 *
 * Domain rules source of truth:
 *   - docs/.claude/skills/hypertrophy-formulas/SKILL.md
 *   - the vault's `02 - Features/Tracking.md`
 *   - Architecture.md
 *
 * All fixtures use ISO timestamps and plain-string UUIDs.
 * Warm-ups are excluded on BOTH sides of PR detection.
 */

import {
  detectPR,
  summarizeSession,
  getActiveSession,
  getExerciseHistorySets,
} from '@/features/session/queries';
import type {
  SetRow,
  WorkoutSessionRow,
  SessionExerciseRow,
} from '@/db';
import type { MusclesBySessionExerciseId } from '@/lib/hypertrophy';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSet(overrides: Partial<SetRow>): SetRow {
  return {
    id: 'set-1',
    user_id: 'user-1',
    session_exercise_id: 'se-1',
    set_index: 0,
    weight_value: 100,
    weight_unit: 'kg',
    weight_kg: 100,
    reps: 10,
    failure_metric: 'rir',
    rir: 2,
    rpe: null,
    is_warmup: false,
    reached_failure: false,
    rest_seconds: null,
    drop_group: null,
    drop_order: null,
    performed_at: '2026-01-01T10:00:00.000Z',
    metadata: {},
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<WorkoutSessionRow>): WorkoutSessionRow {
  return {
    id: 'session-1',
    user_id: 'user-1',
    routine_id: null,
    name: 'Test Session',
    started_at: '2026-01-01T10:00:00.000Z',
    ended_at: null,
    accumulated_active_seconds: 0,
    status: 'in_progress',
    notes: null,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function makeSessionExercise(overrides: Partial<SessionExerciseRow>): SessionExerciseRow {
  return {
    id: 'se-1',
    user_id: 'user-1',
    session_id: 'session-1',
    exercise_id: 'exercise-1',
    order_index: 0,
    started_at: null,
    ended_at: null,
    superset_group: null,
    superset_order: null,
    notes: null,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectPR
// ---------------------------------------------------------------------------

describe('detectPR', () => {
  describe('first-ever working set (no history)', () => {
    it('returns both is1RM and isRepPR as true', () => {
      const candidate = makeSet({ weight_kg: 100, reps: 10 });
      const result = detectPR(candidate, []);
      expect(result.is1RM).toBe(true);
      expect(result.isRepPR).toBe(true);
    });
  });

  describe('estimated-1RM PR', () => {
    it('candidate e1RM > history best → is1RM true', () => {
      const candidate = makeSet({ id: 'c', weight_kg: 110, reps: 10 });
      // e1RM = 110 * (1 + 10/30) = 146.67
      const history = [
        makeSet({ id: 'h1', weight_kg: 100, reps: 10 }), // e1RM = 133.33
      ];
      const result = detectPR(candidate, history);
      expect(result.is1RM).toBe(true);
    });

    it('candidate e1RM === history best → is1RM false (not strictly greater)', () => {
      const candidate = makeSet({ id: 'c', weight_kg: 100, reps: 10 }); // e1RM = 133.33
      const history = [
        makeSet({ id: 'h1', weight_kg: 100, reps: 10 }), // same e1RM
      ];
      const result = detectPR(candidate, history);
      expect(result.is1RM).toBe(false);
    });

    it('candidate e1RM < history best → is1RM false', () => {
      const candidate = makeSet({ id: 'c', weight_kg: 80, reps: 10 }); // e1RM = 106.67
      const history = [
        makeSet({ id: 'h1', weight_kg: 100, reps: 10 }), // e1RM = 133.33
      ];
      const result = detectPR(candidate, history);
      expect(result.is1RM).toBe(false);
    });
  });

  describe('rep-PR', () => {
    it('more reps at equal weight → isRepPR true', () => {
      // history: 100 kg × 8 reps; candidate: 100 kg × 10 reps
      const candidate = makeSet({ id: 'c', weight_kg: 100, reps: 10 });
      const history = [makeSet({ id: 'h1', weight_kg: 100, reps: 8 })];
      const result = detectPR(candidate, history);
      expect(result.isRepPR).toBe(true);
    });

    it('more reps at lower weight than history (history weight >= candidate weight) → isRepPR true', () => {
      // Skill: "more reps than the previous max recorded at a weight_kg equal or greater"
      // history: 110 kg × 5; candidate: 100 kg × 12 (history weight >= candidate weight)
      const candidate = makeSet({ id: 'c', weight_kg: 100, reps: 12 });
      const history = [makeSet({ id: 'h1', weight_kg: 110, reps: 5 })];
      const result = detectPR(candidate, history);
      expect(result.isRepPR).toBe(true);
    });

    it('same reps at same weight → isRepPR false (not strictly greater)', () => {
      const candidate = makeSet({ id: 'c', weight_kg: 100, reps: 8 });
      const history = [makeSet({ id: 'h1', weight_kg: 100, reps: 8 })];
      const result = detectPR(candidate, history);
      expect(result.isRepPR).toBe(false);
    });

    it('candidate reps < history reps at equal weight → isRepPR false', () => {
      const candidate = makeSet({ id: 'c', weight_kg: 100, reps: 6 });
      const history = [makeSet({ id: 'h1', weight_kg: 100, reps: 10 })];
      const result = detectPR(candidate, history);
      expect(result.isRepPR).toBe(false);
    });

    it('history at lighter weight only (none >= candidate weight) → isRepPR true (no bar to beat)', () => {
      // No history set has weight_kg >= 120, so maxRepsAtOrAbove = 0; any reps > 0 wins
      const candidate = makeSet({ id: 'c', weight_kg: 120, reps: 3 });
      const history = [makeSet({ id: 'h1', weight_kg: 100, reps: 12 })];
      const result = detectPR(candidate, history);
      expect(result.isRepPR).toBe(true);
    });
  });

  describe('warm-up exclusion', () => {
    it('warm-up candidate → both false regardless of history', () => {
      const candidate = makeSet({ id: 'c', is_warmup: true, weight_kg: 200, reps: 20 });
      const result = detectPR(candidate, []);
      expect(result.is1RM).toBe(false);
      expect(result.isRepPR).toBe(false);
    });

    it('warm-up in history is ignored — treated as no history', () => {
      // History only has a warmup set; candidate should be treated as first-ever
      const candidate = makeSet({ id: 'c', weight_kg: 100, reps: 10 });
      const warmupHistory = [
        makeSet({ id: 'h1', is_warmup: true, weight_kg: 200, reps: 20 }),
      ];
      const result = detectPR(candidate, warmupHistory);
      // After filtering warmups, history is empty → first-ever → both true
      expect(result.is1RM).toBe(true);
      expect(result.isRepPR).toBe(true);
    });

    it('mixed history: warmup ignored, working history used for comparison', () => {
      const candidate = makeSet({ id: 'c', weight_kg: 100, reps: 10 }); // e1RM ≈ 133.33
      const history = [
        makeSet({ id: 'h1', is_warmup: true, weight_kg: 200, reps: 20 }), // ignored
        makeSet({ id: 'h2', is_warmup: false, weight_kg: 120, reps: 10 }), // e1RM ≈ 160
      ];
      const result = detectPR(candidate, history);
      // Candidate e1RM 133.33 < history best 160 → not a 1RM PR
      expect(result.is1RM).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('candidate with null weight_kg → both false', () => {
      const candidate = makeSet({ id: 'c', weight_kg: null });
      const result = detectPR(candidate, []);
      expect(result.is1RM).toBe(false);
      expect(result.isRepPR).toBe(false);
    });

    it('candidate with null reps → both false', () => {
      const candidate = makeSet({ id: 'c', reps: null });
      const result = detectPR(candidate, []);
      expect(result.is1RM).toBe(false);
      expect(result.isRepPR).toBe(false);
    });

    it('candidate with reps = 0 → both false', () => {
      const candidate = makeSet({ id: 'c', reps: 0 });
      const result = detectPR(candidate, []);
      expect(result.is1RM).toBe(false);
      expect(result.isRepPR).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// summarizeSession
// ---------------------------------------------------------------------------

describe('summarizeSession', () => {
  const SESSION_ID = 'sess-1';
  const SE_ID = 'se-1';
  const EXERCISE_ID = 'ex-1';

  // A completed session
  const session = makeSession({
    id: SESSION_ID,
    status: 'completed',
    started_at: '2026-01-01T10:00:00.000Z',
    ended_at: '2026-01-01T11:30:00.000Z', // 90 minutes = 5400000 ms
  });

  const sessionExercises: Record<string, SessionExerciseRow> = {
    [SE_ID]: makeSessionExercise({ id: SE_ID, session_id: SESSION_ID, exercise_id: EXERCISE_ID }),
  };

  const musclesBySeId: MusclesBySessionExerciseId = {
    [SE_ID]: [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'shoulders', contribution: 0.5 },
    ],
  };

  it('falls back to started_at / ended_at when accumulated_active_seconds is 0 (legacy rows)', () => {
    const sets: Record<string, SetRow> = {};
    const result = summarizeSession(session, sessionExercises, sets, { [SESSION_ID]: session }, musclesBySeId);
    // 90 minutes (legacy row: accumulated 0 → fallback to wall-clock)
    expect(result.durationMs).toBe(90 * 60 * 1000);
  });

  it('TKT-0011: uses accumulated_active_seconds when present, ignoring wall-clock', () => {
    // Wall-clock would be 90 min, but real active time was only 12 min.
    const realActive = makeSession({
      id: SESSION_ID,
      status: 'completed',
      started_at: '2026-01-01T10:00:00.000Z',
      ended_at: '2026-01-01T11:30:00.000Z',
      accumulated_active_seconds: 12 * 60,
    });
    const result = summarizeSession(realActive, sessionExercises, {}, { [SESSION_ID]: realActive }, musclesBySeId);
    expect(result.durationMs).toBe(12 * 60 * 1000);
  });

  it('durationMs is null when ended_at is missing', () => {
    const inProgress = makeSession({ id: SESSION_ID, ended_at: null });
    const result = summarizeSession(inProgress, sessionExercises, {}, { [SESSION_ID]: inProgress }, musclesBySeId);
    expect(result.durationMs).toBeNull();
  });

  it('TKT-0009 #3: clamps durationMs to 0 when started_at is edited to after ended_at', () => {
    // Legacy row (accumulated 0) whose started_at was edited to be later than ended_at.
    const inverted = makeSession({
      id: SESSION_ID,
      status: 'completed',
      started_at: '2026-01-01T12:00:00.000Z',
      ended_at: '2026-01-01T11:30:00.000Z',
      accumulated_active_seconds: 0,
    });
    const result = summarizeSession(inverted, sessionExercises, {}, { [SESSION_ID]: inverted }, musclesBySeId);
    expect(result.durationMs).toBe(0);
  });

  it('effectiveSets excludes warmups', () => {
    const sets: Record<string, SetRow> = {
      's-w': makeSet({ id: 's-w', session_exercise_id: SE_ID, is_warmup: true }),
      's-1': makeSet({ id: 's-1', session_exercise_id: SE_ID, is_warmup: false }),
      's-2': makeSet({ id: 's-2', session_exercise_id: SE_ID, is_warmup: false }),
    };
    const result = summarizeSession(session, sessionExercises, sets, { [SESSION_ID]: session }, musclesBySeId);
    expect(result.effectiveSets).toBe(2);
  });

  it('volumeByMuscle sums contributions of working sets', () => {
    const sets: Record<string, SetRow> = {
      's-w': makeSet({ id: 's-w', session_exercise_id: SE_ID, is_warmup: true }),  // excluded
      's-1': makeSet({ id: 's-1', session_exercise_id: SE_ID, is_warmup: false }), // chest +1.0, shoulders +0.5
      's-2': makeSet({ id: 's-2', session_exercise_id: SE_ID, is_warmup: false }), // chest +1.0, shoulders +0.5
    };
    const result = summarizeSession(session, sessionExercises, sets, { [SESSION_ID]: session }, musclesBySeId);
    expect(result.volumeByMuscle.chest).toBeCloseTo(2.0);
    expect(result.volumeByMuscle.shoulders).toBeCloseTo(1.0);
  });

  it('prSetIds includes the PR set (first-ever set for this exercise)', () => {
    // No history from other sessions → first set is always a PR
    const sets: Record<string, SetRow> = {
      's-1': makeSet({ id: 's-1', session_exercise_id: SE_ID, is_warmup: false, weight_kg: 100, reps: 10 }),
    };
    const result = summarizeSession(session, sessionExercises, sets, { [SESSION_ID]: session }, musclesBySeId);
    expect(result.prSetIds).toContain('s-1');
  });

  it('prSetIds does NOT include non-PR sets when history is better', () => {
    // History session with a better e1RM
    const historySessionId = 'sess-history';
    const historySE_ID = 'se-history';
    const historySession = makeSession({
      id: historySessionId,
      status: 'completed',
      started_at: '2025-12-01T10:00:00.000Z',
      ended_at: '2025-12-01T11:00:00.000Z',
    });
    const historySeRows: Record<string, SessionExerciseRow> = {
      ...sessionExercises,
      [historySE_ID]: makeSessionExercise({
        id: historySE_ID,
        session_id: historySessionId,
        exercise_id: EXERCISE_ID,
      }),
    };

    // History: 120 kg × 10 → e1RM ≈ 160
    // Candidate: 100 kg × 10 → e1RM ≈ 133.33 (not a PR)
    const sets: Record<string, SetRow> = {
      'h-1': makeSet({ id: 'h-1', session_exercise_id: historySE_ID, weight_kg: 120, reps: 10 }),
      's-1': makeSet({ id: 's-1', session_exercise_id: SE_ID, weight_kg: 100, reps: 10 }),
    };
    const allSessions = { [SESSION_ID]: session, [historySessionId]: historySession };
    const result = summarizeSession(session, historySeRows, sets, allSessions, musclesBySeId);
    expect(result.prSetIds).not.toContain('s-1');
  });

  it('prSetIds excludes warmup sets even if they would "beat" history', () => {
    const sets: Record<string, SetRow> = {
      's-w': makeSet({ id: 's-w', session_exercise_id: SE_ID, is_warmup: true, weight_kg: 200, reps: 20 }),
    };
    const result = summarizeSession(session, sessionExercises, sets, { [SESSION_ID]: session }, musclesBySeId);
    expect(result.prSetIds).not.toContain('s-w');
  });
});

// ---------------------------------------------------------------------------
// getActiveSession
// ---------------------------------------------------------------------------

describe('getActiveSession', () => {
  it('returns the in_progress non-deleted session', () => {
    const active = makeSession({ id: 'active', status: 'in_progress', deleted_at: null });
    const completed = makeSession({ id: 'done', status: 'completed', deleted_at: null });
    const sessions = { active, done: completed };
    expect(getActiveSession(sessions)).toBe(active);
  });

  it('returns null when no in_progress session exists', () => {
    const sessions = {
      done: makeSession({ id: 'done', status: 'completed' }),
    };
    expect(getActiveSession(sessions)).toBeNull();
  });

  it('returns null when the only in_progress session is soft-deleted', () => {
    const sessions = {
      deleted: makeSession({
        id: 'deleted',
        status: 'in_progress',
        deleted_at: '2026-01-01T12:00:00.000Z',
      }),
    };
    expect(getActiveSession(sessions)).toBeNull();
  });

  it('returns null for an empty snapshot', () => {
    expect(getActiveSession({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getExerciseHistorySets
// ---------------------------------------------------------------------------

describe('getExerciseHistorySets', () => {
  const EXERCISE_ID = 'ex-1';
  const CURRENT_SESSION_ID = 'sess-current';
  const HISTORY_SESSION_ID = 'sess-history';
  const SE_CURRENT = 'se-current';
  const SE_HISTORY = 'se-history';

  const sessionExercises: Record<string, SessionExerciseRow> = {
    [SE_CURRENT]: makeSessionExercise({
      id: SE_CURRENT,
      session_id: CURRENT_SESSION_ID,
      exercise_id: EXERCISE_ID,
    }),
    [SE_HISTORY]: makeSessionExercise({
      id: SE_HISTORY,
      session_id: HISTORY_SESSION_ID,
      exercise_id: EXERCISE_ID,
    }),
  };

  it('returns working sets from sessions other than the excluded one', () => {
    const sets: Record<string, SetRow> = {
      'current-1': makeSet({ id: 'current-1', session_exercise_id: SE_CURRENT }),
      'history-1': makeSet({ id: 'history-1', session_exercise_id: SE_HISTORY }),
    };
    const result = getExerciseHistorySets(sets, sessionExercises, EXERCISE_ID, {
      excludeSessionId: CURRENT_SESSION_ID,
    });
    expect(result.map((s) => s.id)).toEqual(['history-1']);
  });

  it('excludes current session sets (for PR context)', () => {
    const sets: Record<string, SetRow> = {
      'current-1': makeSet({ id: 'current-1', session_exercise_id: SE_CURRENT }),
      'current-2': makeSet({ id: 'current-2', session_exercise_id: SE_CURRENT }),
    };
    const result = getExerciseHistorySets(sets, sessionExercises, EXERCISE_ID, {
      excludeSessionId: CURRENT_SESSION_ID,
    });
    expect(result).toHaveLength(0);
  });

  it('excludes soft-deleted sets', () => {
    const sets: Record<string, SetRow> = {
      'history-deleted': makeSet({
        id: 'history-deleted',
        session_exercise_id: SE_HISTORY,
        deleted_at: '2026-01-01T11:00:00.000Z',
      }),
      'history-ok': makeSet({ id: 'history-ok', session_exercise_id: SE_HISTORY }),
    };
    const result = getExerciseHistorySets(sets, sessionExercises, EXERCISE_ID, {
      excludeSessionId: CURRENT_SESSION_ID,
    });
    expect(result.map((s) => s.id)).toEqual(['history-ok']);
  });

  it('excludes warmup sets (history only over working sets)', () => {
    const sets: Record<string, SetRow> = {
      'h-warmup': makeSet({ id: 'h-warmup', session_exercise_id: SE_HISTORY, is_warmup: true }),
      'h-working': makeSet({ id: 'h-working', session_exercise_id: SE_HISTORY, is_warmup: false }),
    };
    const result = getExerciseHistorySets(sets, sessionExercises, EXERCISE_ID, {
      excludeSessionId: CURRENT_SESSION_ID,
    });
    expect(result.map((s) => s.id)).toEqual(['h-working']);
  });

  it('excludes sets for different exercises via session_exercise join', () => {
    const OTHER_EXERCISE_ID = 'ex-other';
    const SE_OTHER = 'se-other';
    const seWithOther: Record<string, SessionExerciseRow> = {
      ...sessionExercises,
      [SE_OTHER]: makeSessionExercise({
        id: SE_OTHER,
        session_id: HISTORY_SESSION_ID,
        exercise_id: OTHER_EXERCISE_ID,
      }),
    };
    const sets: Record<string, SetRow> = {
      'h-other': makeSet({ id: 'h-other', session_exercise_id: SE_OTHER }),
      'h-1': makeSet({ id: 'h-1', session_exercise_id: SE_HISTORY }),
    };
    const result = getExerciseHistorySets(sets, seWithOther, EXERCISE_ID, {
      excludeSessionId: CURRENT_SESSION_ID,
    });
    // Should only return h-1 (for EXERCISE_ID), not h-other (for OTHER_EXERCISE_ID)
    expect(result.map((s) => s.id)).toEqual(['h-1']);
  });

  it('excludes soft-deleted session_exercises', () => {
    const seWithDeleted: Record<string, SessionExerciseRow> = {
      ...sessionExercises,
      [SE_HISTORY]: makeSessionExercise({
        id: SE_HISTORY,
        session_id: HISTORY_SESSION_ID,
        exercise_id: EXERCISE_ID,
        deleted_at: '2026-01-01T11:00:00.000Z',
      }),
    };
    const sets: Record<string, SetRow> = {
      'h-1': makeSet({ id: 'h-1', session_exercise_id: SE_HISTORY }),
    };
    const result = getExerciseHistorySets(sets, seWithDeleted, EXERCISE_ID, {
      excludeSessionId: CURRENT_SESSION_ID,
    });
    expect(result).toHaveLength(0);
  });

  it('with no excludeSessionId option, returns all matching working sets', () => {
    const sets: Record<string, SetRow> = {
      'current-1': makeSet({ id: 'current-1', session_exercise_id: SE_CURRENT }),
      'history-1': makeSet({ id: 'history-1', session_exercise_id: SE_HISTORY }),
    };
    const result = getExerciseHistorySets(sets, sessionExercises, EXERCISE_ID);
    expect(result).toHaveLength(2);
  });
});
