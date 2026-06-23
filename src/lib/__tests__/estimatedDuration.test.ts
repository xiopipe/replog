/**
 * Tests for src/lib/estimatedDuration.ts (TKT-0031).
 */

import {
  estimatedDurationMinutes,
  formatEstimatedDuration,
  roundToNearest5,
  DEFAULT_MINUTES_PER_EXERCISE,
  HISTORY_WINDOW,
} from '../estimatedDuration';
import type { SessionForDuration } from '../estimatedDuration';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  overrides: Partial<SessionForDuration> & { id?: string },
): [string, SessionForDuration] {
  const id = overrides.id ?? Math.random().toString(36).slice(2);
  const row: SessionForDuration = {
    routine_id: 'r1',
    status: 'completed',
    deleted_at: null,
    accumulated_active_seconds: 0,
    started_at: new Date(Date.now() - 7 * 86400_000).toISOString(),
    ended_at: new Date(Date.now() - 7 * 86400_000 + 3600_000).toISOString(),
    ...overrides,
  };
  return [id, row];
}

// ---------------------------------------------------------------------------
// roundToNearest5
// ---------------------------------------------------------------------------

describe('roundToNearest5', () => {
  it('rounds 22 to 20', () => expect(roundToNearest5(22)).toBe(20));
  it('rounds 23 to 25', () => expect(roundToNearest5(23)).toBe(25));
  it('returns minimum 5 for tiny values', () => {
    expect(roundToNearest5(1)).toBe(5);
    expect(roundToNearest5(0)).toBe(5);
  });
  it('rounds 47 to 45', () => expect(roundToNearest5(47)).toBe(45));
  it('rounds 48 to 50', () => expect(roundToNearest5(48)).toBe(50));
});

// ---------------------------------------------------------------------------
// formatEstimatedDuration
// ---------------------------------------------------------------------------

describe('formatEstimatedDuration', () => {
  it('returns "—" for null', () => expect(formatEstimatedDuration(null)).toBe('—'));
  it('formats < 60 min as ~Xmin', () => {
    expect(formatEstimatedDuration(45)).toBe('~45min');
    expect(formatEstimatedDuration(5)).toBe('~5min');
  });
  it('formats 60 min as ~1h', () => expect(formatEstimatedDuration(60)).toBe('~1h'));
  it('formats 75 min as ~1h 15min', () => expect(formatEstimatedDuration(75)).toBe('~1h 15min'));
  it('formats 120 min as ~2h', () => expect(formatEstimatedDuration(120)).toBe('~2h'));
});

// ---------------------------------------------------------------------------
// estimatedDurationMinutes
// ---------------------------------------------------------------------------

describe('estimatedDurationMinutes', () => {
  it('uses accumulated_active_seconds when > 0', () => {
    const sessions = Object.fromEntries([
      makeSession({ accumulated_active_seconds: 3600, ended_at: null }), // 60 min
    ]);
    expect(estimatedDurationMinutes('r1', sessions, 5)).toBe(60);
  });

  it('falls back to ended_at - started_at when accumulated_active_seconds is 0', () => {
    const startedAt = new Date(Date.now() - 86400_000).toISOString();
    const endedAt = new Date(new Date(startedAt).getTime() + 45 * 60_000).toISOString();
    const sessions = Object.fromEntries([
      makeSession({ accumulated_active_seconds: 0, started_at: startedAt, ended_at: endedAt }),
    ]);
    expect(estimatedDurationMinutes('r1', sessions, 5)).toBe(45);
  });

  it('averages last N=3 sessions, ignoring older ones', () => {
    const makeAt = (daysAgo: number, seconds: number) =>
      makeSession({
        accumulated_active_seconds: seconds,
        started_at: new Date(Date.now() - daysAgo * 86400_000).toISOString(),
      });
    // 4 sessions: 60, 30, 45, 90 min (oldest first, but sorted newest first for window)
    const sessions = Object.fromEntries([
      makeAt(1, 3600),   // 60 min — newest
      makeAt(2, 1800),   // 30 min
      makeAt(3, 2700),   // 45 min
      makeAt(4, 5400),   // 90 min — should be excluded (4th)
    ]);
    // avg of 60, 30, 45 = 45 min → rounds to 45
    expect(estimatedDurationMinutes('r1', sessions, 5)).toBe(45);
  });

  it('uses heuristic when no completed sessions for routine', () => {
    const sessions = Object.fromEntries([
      makeSession({ routine_id: 'other-routine' }),
    ]);
    // 6 exercises × 5 min = 30
    expect(estimatedDurationMinutes('r1', sessions, 6)).toBe(30);
  });

  it(`uses ${DEFAULT_MINUTES_PER_EXERCISE} min/exercise heuristic`, () => {
    expect(estimatedDurationMinutes('r1', {}, 4)).toBe(20);
  });

  it('returns null when no sessions and no exercises', () => {
    expect(estimatedDurationMinutes('r1', {}, 0)).toBeNull();
  });

  it('ignores deleted sessions', () => {
    const sessions = Object.fromEntries([
      makeSession({ accumulated_active_seconds: 3600, deleted_at: '2026-01-01T00:00:00Z' }),
    ]);
    // Falls back to heuristic: 4 exercises × 5 = 20
    expect(estimatedDurationMinutes('r1', sessions, 4)).toBe(20);
  });

  it('ignores in_progress sessions', () => {
    const sessions = Object.fromEntries([
      makeSession({ status: 'in_progress', accumulated_active_seconds: 3600 }),
    ]);
    expect(estimatedDurationMinutes('r1', sessions, 4)).toBe(20);
  });

  it('respects HISTORY_WINDOW constant', () => {
    expect(HISTORY_WINDOW).toBe(3);
  });

  it('never returns 0 (minimum 5 min)', () => {
    // Even a very short session rounds up to 5
    const startedAt = new Date(Date.now() - 86400_000).toISOString();
    const endedAt = new Date(new Date(startedAt).getTime() + 60_000).toISOString(); // 1 min
    const sessions = Object.fromEntries([
      makeSession({ accumulated_active_seconds: 0, started_at: startedAt, ended_at: endedAt }),
    ]);
    expect(estimatedDurationMinutes('r1', sessions, 0)).toBeGreaterThanOrEqual(5);
  });
});
