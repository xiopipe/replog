/**
 * Estimated routine duration — pure computation, no React/RN imports.
 *
 * TKT-0031: derive estimated duration from session history for a given
 * routine_id.  Computation rules (EARS-spec):
 *
 *   1. If the routine has ≥ 1 completed session, average the last N=3
 *      completed sessions' durations for that routine_id.
 *      Duration source: accumulated_active_seconds when > 0, otherwise
 *      (ended_at - started_at).
 *
 *   2. If no history, fallback = exerciseCount × DEFAULT_MINUTES_PER_EXERCISE.
 *
 *   3. Round to nearest 5 min.
 *
 *   4. If rounding yields 0 (e.g. very short heuristic), return 5 min minimum.
 *
 *   5. If neither history nor exerciseCount available, return null ("—").
 *
 * Display format (caller responsibility): "~X min" or "~Xh Ymin".
 */

export const DEFAULT_MINUTES_PER_EXERCISE = 5;
export const HISTORY_WINDOW = 3;

export interface SessionForDuration {
  routine_id: string | null;
  status: string;
  deleted_at: string | null;
  accumulated_active_seconds: number;
  started_at: string;
  ended_at: string | null;
}

/**
 * Compute the estimated duration (in minutes) for a given routine.
 *
 * @param routineId       ID of the routine to estimate.
 * @param sessions        All session rows (any shape with the required fields).
 * @param exerciseCount   Number of exercises in the routine (for the fallback).
 * @returns               Estimated duration in minutes (≥ 5, rounded to nearest 5)
 *                        or null if completely unavailable.
 */
export function estimatedDurationMinutes(
  routineId: string,
  sessions: Record<string, SessionForDuration>,
  exerciseCount: number,
): number | null {
  // Filter completed, non-deleted sessions for this routine
  const relevant = Object.values(sessions)
    .filter(
      (s) =>
        s.routine_id === routineId &&
        s.status === 'completed' &&
        !s.deleted_at,
    )
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, HISTORY_WINDOW);

  if (relevant.length > 0) {
    const durationSecondsArr = relevant.map((s) => {
      if (s.accumulated_active_seconds > 0) {
        return s.accumulated_active_seconds;
      }
      if (s.ended_at) {
        return Math.max(
          0,
          (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000,
        );
      }
      return 0;
    });

    const validDurations = durationSecondsArr.filter((d) => d > 0);
    if (validDurations.length > 0) {
      const avgSeconds =
        validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length;
      const avgMinutes = avgSeconds / 60;
      return roundToNearest5(avgMinutes);
    }
  }

  // Fallback: heuristic from exercise count
  if (exerciseCount > 0) {
    const heuristicMinutes = exerciseCount * DEFAULT_MINUTES_PER_EXERCISE;
    return roundToNearest5(heuristicMinutes);
  }

  return null;
}

/**
 * Round to nearest 5 minutes, with a minimum of 5.
 */
export function roundToNearest5(minutes: number): number {
  const rounded = Math.round(minutes / 5) * 5;
  return Math.max(5, rounded);
}

/**
 * Format estimated duration for display.
 *
 * Returns "~Xh Ymin" when ≥ 60 min, "~Xmin" otherwise, or "—" if null.
 */
export function formatEstimatedDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `~${h}h` : `~${h}h ${m}min`;
  }
  return `~${minutes}min`;
}
