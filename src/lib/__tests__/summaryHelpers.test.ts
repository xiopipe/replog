/**
 * Unit tests for src/lib/summaryHelpers.ts
 *
 * Covers TKT-0029, TKT-0030, TKT-0060 pure helpers.
 * Node env — no RN imports.
 */

import {
  parseDurationInput,
  countCompletedExercises,
  getExerciseDurationSeconds,
  formatExerciseTime,
} from '../summaryHelpers';
import type { SessionExerciseRow, SetRow } from '@/db';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const T = (key: string, opts?: Record<string, unknown>): string => {
  const templates: Record<string, string> = {
    'summary.exercise_time_min': '{{count}} min',
    'summary.exercise_time_sec': '{{count}} seg',
  };
  return (templates[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''));
};

function makeSet(overrides: Partial<SetRow> = {}): SetRow {
  return {
    id: 'set-1',
    user_id: 'u1',
    session_exercise_id: 'se-1',
    set_index: 0,
    weight_value: 80,
    weight_unit: 'kg',
    weight_kg: 80,
    reps: 8,
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

function makeSE(overrides: Partial<SessionExerciseRow> = {}): SessionExerciseRow {
  return {
    id: 'se-1',
    user_id: 'u1',
    session_id: 'session-1',
    exercise_id: 'ex-1',
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
// parseDurationInput (TKT-0030)
// ---------------------------------------------------------------------------

describe('parseDurationInput', () => {
  it('parses plain minutes', () => {
    const r = parseDurationInput('83');
    expect(r.seconds).toBe(83 * 60);
    expect(r.errorKey).toBeNull();
    expect(r.warn24h).toBe(false);
  });

  it('parses decimal minutes', () => {
    const r = parseDurationInput('1.5');
    expect(r.seconds).toBe(90);
  });

  it('parses h:mm colon format', () => {
    const r = parseDurationInput('1:23');
    expect(r.seconds).toBe(1 * 3600 + 23 * 60);
    expect(r.errorKey).toBeNull();
  });

  it('parses h:mm:ss three-part format', () => {
    const r = parseDurationInput('1:23:45');
    expect(r.seconds).toBe(1 * 3600 + 23 * 60 + 45);
  });

  it('rejects zero', () => {
    const r = parseDurationInput('0');
    expect(r.seconds).toBeNull();
    expect(r.errorKey).toBe('summary.duration_edit_error_zero');
  });

  it('rejects empty string', () => {
    const r = parseDurationInput('');
    expect(r.seconds).toBeNull();
    expect(r.errorKey).toBe('summary.duration_edit_error_empty');
  });

  it('rejects invalid format', () => {
    const r = parseDurationInput('abc');
    expect(r.seconds).toBeNull();
    expect(r.errorKey).toBe('summary.duration_edit_error_format');
  });

  it('rejects invalid colon format', () => {
    const r = parseDurationInput('1:60');
    expect(r.seconds).toBeNull();
    expect(r.errorKey).toBe('summary.duration_edit_error_format');
  });

  it('sets warn24h for values over 24h', () => {
    const r = parseDurationInput('1500'); // 1500 min = 25 h
    expect(r.seconds).toBe(1500 * 60);
    expect(r.warn24h).toBe(true);
    expect(r.errorKey).toBeNull();
  });

  it('handles comma as decimal separator', () => {
    const r = parseDurationInput('1,5');
    expect(r.seconds).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// countCompletedExercises (TKT-0029)
// ---------------------------------------------------------------------------

describe('countCompletedExercises', () => {
  it('counts exercises with at least one working set', () => {
    const se1 = makeSE({ id: 'se-1', exercise_id: 'ex-1' });
    const se2 = makeSE({ id: 'se-2', exercise_id: 'ex-2' });
    const sets: Record<string, SetRow> = {
      's1': makeSet({ id: 's1', session_exercise_id: 'se-1', is_warmup: false }),
      's2': makeSet({ id: 's2', session_exercise_id: 'se-2', is_warmup: true }),
    };
    expect(countCompletedExercises([se1, se2], sets)).toBe(1);
  });

  it('returns 0 when all sets are warmups', () => {
    const se1 = makeSE({ id: 'se-1' });
    const sets: Record<string, SetRow> = {
      's1': makeSet({ id: 's1', session_exercise_id: 'se-1', is_warmup: true }),
    };
    expect(countCompletedExercises([se1], sets)).toBe(0);
  });

  it('excludes soft-deleted sets', () => {
    const se1 = makeSE({ id: 'se-1' });
    const sets: Record<string, SetRow> = {
      's1': makeSet({ id: 's1', session_exercise_id: 'se-1', is_warmup: false, deleted_at: '2026-01-01T12:00:00Z' }),
    };
    expect(countCompletedExercises([se1], sets)).toBe(0);
  });

  it('returns 0 when no sets', () => {
    const se1 = makeSE({ id: 'se-1' });
    expect(countCompletedExercises([se1], {})).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getExerciseDurationSeconds (TKT-0029)
// ---------------------------------------------------------------------------

describe('getExerciseDurationSeconds', () => {
  it('returns seconds between started_at and ended_at', () => {
    const se = makeSE({
      started_at: '2026-01-01T10:00:00.000Z',
      ended_at: '2026-01-01T10:08:30.000Z',
    });
    expect(getExerciseDurationSeconds(se)).toBe(8 * 60 + 30);
  });

  it('returns null when started_at is missing', () => {
    const se = makeSE({ started_at: null, ended_at: '2026-01-01T10:08:30.000Z' });
    expect(getExerciseDurationSeconds(se)).toBeNull();
  });

  it('returns null when ended_at is missing', () => {
    const se = makeSE({ started_at: '2026-01-01T10:00:00.000Z', ended_at: null });
    expect(getExerciseDurationSeconds(se)).toBeNull();
  });

  it('returns null for zero or negative difference', () => {
    const se = makeSE({
      started_at: '2026-01-01T10:00:00.000Z',
      ended_at: '2026-01-01T10:00:00.000Z',
    });
    expect(getExerciseDurationSeconds(se)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatExerciseTime (TKT-0029)
// ---------------------------------------------------------------------------

describe('formatExerciseTime', () => {
  it('formats minutes for >= 60 seconds', () => {
    expect(formatExerciseTime(8 * 60, T)).toBe('8 min');
  });

  it('formats seconds for < 60 seconds', () => {
    expect(formatExerciseTime(45, T)).toBe('45 seg');
  });

  it('returns null for null input', () => {
    expect(formatExerciseTime(null, T)).toBeNull();
  });

  it('returns null for zero', () => {
    expect(formatExerciseTime(0, T)).toBeNull();
  });
});
