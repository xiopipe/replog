/**
 * summaryHelpers — pure helpers for the session summary screen.
 *
 * All functions are node-environment safe (no RN imports).
 *
 * Covers:
 *   TKT-0029: completed exercise count + per-exercise time formatting
 *   TKT-0030: duration parsing/validation (mm:ss or plain minutes)
 *   TKT-0060: PR type + delta re-derivation for the summary PR list
 */

import type { SessionExerciseRow, SetRow } from '@/db';
import type { PRType } from '@/features/session/PRBadge';
import { estimated1RM } from '@/lib/hypertrophy';
import {
  getExerciseHistorySets,
  detectPR,
  getSetsForSessionExercise,
} from '@/features/session/queries';

// ---------------------------------------------------------------------------
// TKT-0029: exercises completed/planned
// ---------------------------------------------------------------------------

/**
 * Count session exercises that have at least one non-warmup, non-deleted set.
 * "Completed" per spec: ≥1 working set.
 */
export function countCompletedExercises(
  sessionExercises: SessionExerciseRow[],
  sets: Record<string, SetRow>,
): number {
  return sessionExercises.filter((se) => {
    const exerciseSets = getSetsForSessionExercise(sets, se.id);
    return exerciseSets.some((s) => !s.is_warmup);
  }).length;
}

/**
 * Compute per-exercise duration in seconds from started_at / ended_at.
 * Returns null when either timestamp is absent (graceful degradation).
 */
export function getExerciseDurationSeconds(se: SessionExerciseRow): number | null {
  if (!se.started_at || !se.ended_at) return null;
  const diff = new Date(se.ended_at).getTime() - new Date(se.started_at).getTime();
  if (diff <= 0) return null;
  return Math.floor(diff / 1000);
}

/**
 * Format exercise duration seconds as a chip label ("8 min", "45 seg").
 * Returns null if durationSeconds is null (chip should be omitted).
 */
export function formatExerciseTime(
  durationSeconds: number | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (durationSeconds == null || durationSeconds <= 0) return null;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  if (minutes >= 1) {
    return t('summary.exercise_time_min', { count: minutes });
  }
  return t('summary.exercise_time_sec', { count: seconds });
}

// ---------------------------------------------------------------------------
// TKT-0030: duration parsing / validation
// ---------------------------------------------------------------------------

export interface DurationParseResult {
  /** Total seconds, or null if the input could not be parsed. */
  seconds: number | null;
  /** Human-readable parse error (i18n key) or null if valid. */
  errorKey: string | null;
}

/**
 * Parse a user-entered duration string into seconds.
 *
 * Accepted formats:
 *   "83"       → 83 minutes (plain number ≥1)
 *   "1:23"     → 1 h 23 min (colon-separated h:mm)
 *   "1:23:45"  → 1 h 23 min 45 s (h:mm:ss)
 *   "83:20"    → 83 min 20 s (mm:ss when first part ≥ 60 treated as minutes)
 *
 * Validation:
 *   - 0 or negative → error
 *   - > 86400 s (24 h) → valid but warn flag set
 */
export function parseDurationInput(raw: string): DurationParseResult & { warn24h: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { seconds: null, errorKey: 'summary.duration_edit_error_empty', warn24h: false };
  }

  let totalSeconds: number;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => parseInt(p, 10));
    if (parts.some((p) => Number.isNaN(p) || p < 0)) {
      return { seconds: null, errorKey: 'summary.duration_edit_error_format', warn24h: false };
    }
    if (parts.length === 2) {
      // mm:ss or h:mm — treat first segment as minutes if second < 60
      const [a, b] = parts as [number, number];
      if (b >= 60) {
        return { seconds: null, errorKey: 'summary.duration_edit_error_format', warn24h: false };
      }
      // Interpret as h:mm when first part could be hours (any value), b < 60
      totalSeconds = a * 60 * 60 + b * 60;
    } else if (parts.length === 3) {
      const [h, m, s] = parts as [number, number, number];
      if (m >= 60 || s >= 60) {
        return { seconds: null, errorKey: 'summary.duration_edit_error_format', warn24h: false };
      }
      totalSeconds = h * 3600 + m * 60 + s;
    } else {
      return { seconds: null, errorKey: 'summary.duration_edit_error_format', warn24h: false };
    }
  } else {
    // Plain number → minutes
    const mins = parseFloat(trimmed.replace(',', '.'));
    if (Number.isNaN(mins)) {
      return { seconds: null, errorKey: 'summary.duration_edit_error_format', warn24h: false };
    }
    totalSeconds = Math.round(mins * 60);
  }

  if (totalSeconds <= 0) {
    return { seconds: null, errorKey: 'summary.duration_edit_error_zero', warn24h: false };
  }

  const warn24h = totalSeconds > 24 * 3600;
  return { seconds: totalSeconds, errorKey: null, warn24h };
}

// ---------------------------------------------------------------------------
// TKT-0060: PR type + delta re-derivation
// ---------------------------------------------------------------------------

export interface PRSummaryItem {
  setId: string;
  exerciseName: string;
  exerciseId: string;
  /** PR type: '1rm' or 'rep'. */
  prType: PRType;
  /** e1RM delta in user's display unit (null for first-ever set). */
  delta: number | null;
  /** Weight display string (already formatted by caller). */
  weightDisplay: string;
  reps: number;
}

/**
 * Build the enriched PR summary list, re-deriving prType and delta for each
 * PR set.  This function is pure: it does not touch observables.
 *
 * @param prSetIds       - Set IDs that are PRs (from summarizeSession).
 * @param sets           - Full sets snapshot.
 * @param sessionExercises - Full session exercises snapshot.
 * @param allExercises   - Merged exercise catalog.
 * @param sessionId      - Current session id (excluded from history).
 * @param userUnit       - 'kg' | 'lb' for delta conversion.
 * @param kgToLbFn       - Converter (to avoid circular imports from hypertrophy).
 * @param formatWeightFn - Display weight formatter (set, unit) → string.
 */
export function buildPRSummaryItems(
  prSetIds: string[],
  sets: Record<string, SetRow>,
  sessionExercises: Record<string, SessionExerciseRow>,
  allExercises: Record<string, { name: string }>,
  sessionId: string,
  userUnit: 'kg' | 'lb',
  kgToLbFn: (kg: number) => number,
  formatWeightFn: (set: SetRow, unit: 'kg' | 'lb') => string,
): PRSummaryItem[] {
  const items: PRSummaryItem[] = [];

  for (const setId of prSetIds) {
    const set = sets[setId];
    if (!set) continue;

    const se = sessionExercises[set.session_exercise_id];
    if (!se) continue;

    const exercise = allExercises[se.exercise_id];
    const exerciseName = exercise?.name ?? '—';

    if (set.weight_kg == null || set.reps == null || set.reps < 1) continue;

    // Re-derive history (same logic as session screen PR check)
    const history = getExerciseHistorySets(sets, sessionExercises, se.exercise_id, {
      excludeSessionId: sessionId,
    });
    const { is1RM, isRepPR } = detectPR(set, history);

    const prType: PRType = is1RM ? '1rm' : 'rep';

    let delta: number | null = null;
    if (is1RM) {
      const currentE1RM = estimated1RM(set.weight_kg, set.reps);
      const workingHistory = history.filter(
        (s) => !s.is_warmup && !s.deleted_at && s.weight_kg != null && s.reps != null && s.reps >= 1,
      );
      if (workingHistory.length > 0) {
        const prevBest = Math.max(
          ...workingHistory.map((s) => estimated1RM(s.weight_kg!, s.reps!)),
        );
        const deltaKg = currentE1RM - prevBest;
        delta = userUnit === 'lb' ? kgToLbFn(deltaKg) : deltaKg;
      }
    } else if (isRepPR) {
      // Rep PR delta: reps above the max at this weight
      const setsAtOrAbove = history.filter(
        (s) =>
          !s.is_warmup &&
          !s.deleted_at &&
          s.weight_kg != null &&
          s.weight_kg >= set.weight_kg! &&
          s.reps != null &&
          s.reps >= 1,
      );
      const maxReps = setsAtOrAbove.length > 0
        ? Math.max(...setsAtOrAbove.map((s) => s.reps!))
        : 0;
      delta = set.reps - maxReps;
      if (delta <= 0) delta = null; // first-ever or no improvement trackable
    }

    items.push({
      setId,
      exerciseName,
      exerciseId: se.exercise_id,
      prType,
      delta,
      weightDisplay: formatWeightFn(set, userUnit),
      reps: set.reps,
    });
  }

  return items;
}
