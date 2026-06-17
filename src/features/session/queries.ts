/**
 * Session feature — pure selector functions.
 *
 * All functions accept plain snapshots (Record<string, Row>) taken from
 * Legend-State observables and return derived data.  No side effects, no
 * Legend-State or React Native imports.
 *
 * Naming:
 *   get*  — selector that returns data from a snapshot.
 *   detect* / summarize* — domain computations.
 */

import type {
  WorkoutSessionRow,
  SessionExerciseRow,
  SetRow,
  MuscleEnum,
} from '@/db';
import {
  estimated1RM,
  effectiveSetCount,
  fractionalVolumeByMuscle,
  tonnage,
  type MusclesBySessionExerciseId,
} from '@/lib/hypertrophy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRResult {
  /** True if the set's estimated 1RM beats the previous best estimated 1RM. */
  is1RM: boolean;
  /** True if the set has more reps at a weight >= any historical set's weight. */
  isRepPR: boolean;
}

export interface SessionSummary {
  /** Session duration in milliseconds (ended_at - started_at). null if not ended. */
  durationMs: number | null;
  /** Count of working (non-warmup) sets. */
  effectiveSets: number;
  /** Total tonnage in kg: Σ (weight_kg × reps) over working sets. */
  tonnageKg: number;
  /** Fractional volume per muscle group over working sets. */
  volumeByMuscle: Partial<Record<MuscleEnum, number>>;
  /**
   * IDs of sets that triggered a PR in this session — at most ONE per exercise
   * (the single best PR for that exercise), so the summary never lists the same
   * exercise twice.
   */
  prSetIds: string[];
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Return the single in-progress session, or null.
 *
 * An in-progress session has status === 'in_progress', is not soft-deleted,
 * and there should be at most one per user at any time.
 */
export function getActiveSession(
  sessions: Record<string, WorkoutSessionRow>,
): WorkoutSessionRow | null {
  for (const session of Object.values(sessions)) {
    if (session.status === 'in_progress' && !session.deleted_at) {
      return session;
    }
  }
  return null;
}

/**
 * Return the session exercises for a given session, sorted by order_index,
 * excluding soft-deleted rows.
 */
export function getSessionExercises(
  sessionExercises: Record<string, SessionExerciseRow>,
  sessionId: string,
): SessionExerciseRow[] {
  return Object.values(sessionExercises)
    .filter((se) => se.session_id === sessionId && !se.deleted_at)
    .sort((a, b) => a.order_index - b.order_index);
}

/**
 * Return the sets for a given session_exercise, sorted by set_index,
 * excluding soft-deleted rows.
 */
export function getSetsForSessionExercise(
  sets: Record<string, SetRow>,
  sessionExerciseId: string,
): SetRow[] {
  return Object.values(sets)
    .filter((s) => s.session_exercise_id === sessionExerciseId && !s.deleted_at)
    .sort((a, b) => a.set_index - b.set_index);
}

/**
 * Return all WORKING sets the user has ever logged for a given exercise,
 * across all sessions except (optionally) the current one.
 *
 * Used for PR checks and smart prefill.
 *
 * Join path: sets → session_exercises (exercise_id) → filter by exerciseId.
 * Only working sets (is_warmup === false) are returned.
 * Soft-deleted rows on both sides are excluded.
 *
 * @param sets               - Snapshot of the sets observable.
 * @param sessionExercises   - Snapshot of the session_exercises observable.
 * @param exerciseId         - The exercise to look up history for.
 * @param opts.excludeSessionId - Exclude sets from this session (e.g. the current one).
 */
export function getExerciseHistorySets(
  sets: Record<string, SetRow>,
  sessionExercises: Record<string, SessionExerciseRow>,
  exerciseId: string,
  opts?: { excludeSessionId?: string },
): SetRow[] {
  // Build a set of session_exercise IDs for this exercise (excluding the current session)
  const validSeIds = new Set<string>();
  for (const se of Object.values(sessionExercises)) {
    if (se.deleted_at) continue;
    if (se.exercise_id !== exerciseId) continue;
    if (opts?.excludeSessionId && se.session_id === opts.excludeSessionId) continue;
    validSeIds.add(se.id);
  }

  const result: SetRow[] = [];
  for (const set of Object.values(sets)) {
    if (set.deleted_at) continue;
    if (set.is_warmup) continue; // history only over working sets
    if (!validSeIds.has(set.session_exercise_id)) continue;
    result.push(set);
  }
  return result;
}

/**
 * Detect whether a candidate set is a PR compared to the given history sets.
 *
 * PR definition (Tracking.md + hypertrophy-formulas SKILL.md):
 *   Estimated-1RM PR: candidate's estimated 1RM (Epley) > max estimated 1RM
 *                     across all history working sets.
 *   Rep-PR:           candidate.reps > max reps among history sets with
 *                     weight_kg >= candidate.weight_kg.
 *
 * Rules:
 *   - Warm-ups never count on EITHER side (caller must pass only working
 *     history sets, but this function also guards is_warmup on historySets).
 *   - A set with null weight_kg or null reps cannot be a PR.
 *   - The first-ever working set for an exercise IS a PR by definition
 *     (no previous best to beat).
 */
export function detectPR(
  candidateSet: SetRow,
  historySets: SetRow[],
): PRResult {
  // Warm-up sets never qualify
  if (candidateSet.is_warmup) return { is1RM: false, isRepPR: false };
  if (candidateSet.weight_kg == null || candidateSet.reps == null || candidateSet.reps < 1) {
    return { is1RM: false, isRepPR: false };
  }

  const workingHistory = historySets.filter(
    (s) => !s.is_warmup && !s.deleted_at && s.weight_kg != null && s.reps != null && s.reps >= 1,
  );

  // No history → first set is always a PR
  if (workingHistory.length === 0) {
    return { is1RM: true, isRepPR: true };
  }

  const candidateE1RM = estimated1RM(candidateSet.weight_kg, candidateSet.reps);

  // Estimated-1RM PR: beat the previous best e1RM
  const maxHistoryE1RM = Math.max(
    ...workingHistory.map((s) => estimated1RM(s.weight_kg!, s.reps!)),
  );
  const is1RM = candidateE1RM > maxHistoryE1RM;

  // Rep-PR: more reps at a weight >= candidate weight
  const setsAtOrAboveWeight = workingHistory.filter(
    (s) => s.weight_kg! >= candidateSet.weight_kg!,
  );
  const maxRepsAtOrAboveWeight = setsAtOrAboveWeight.length > 0
    ? Math.max(...setsAtOrAboveWeight.map((s) => s.reps!))
    : 0;
  const isRepPR = candidateSet.reps > maxRepsAtOrAboveWeight;

  return { is1RM, isRepPR };
}

/**
 * Return the sets from the most recent COMPLETED session that included a given
 * exercise.  Used for "duplicate last session" / prefill logic.
 *
 * Returns only working sets sorted by set_index.  Returns [] if no history.
 *
 * @param sets               - Snapshot of the sets observable.
 * @param sessionExercises   - Snapshot of the session_exercises observable.
 * @param sessions           - Snapshot of the workout_sessions observable.
 * @param exerciseId         - Exercise to look up.
 * @param opts.excludeSessionId - Session to exclude (current in-progress session).
 */
export function getLastSetsForExercise(
  sets: Record<string, SetRow>,
  sessionExercises: Record<string, SessionExerciseRow>,
  sessions: Record<string, WorkoutSessionRow>,
  exerciseId: string,
  opts?: { excludeSessionId?: string },
): SetRow[] {
  // Collect session_exercise rows for this exercise in completed sessions,
  // ordered by started_at desc to find the most recent.
  const candidates: { se: SessionExerciseRow; sessionStartedAt: string }[] = [];

  for (const se of Object.values(sessionExercises)) {
    if (se.deleted_at) continue;
    if (se.exercise_id !== exerciseId) continue;
    if (opts?.excludeSessionId && se.session_id === opts.excludeSessionId) continue;

    const session = sessions[se.session_id];
    if (!session || session.deleted_at) continue;
    if (session.status !== 'completed') continue;

    candidates.push({ se, sessionStartedAt: session.started_at });
  }

  if (candidates.length === 0) return [];

  // Pick the most recent session (max started_at)
  candidates.sort((a, b) => b.sessionStartedAt.localeCompare(a.sessionStartedAt));
  const { se: latestSe } = candidates[0]!;

  return Object.values(sets)
    .filter(
      (s) =>
        s.session_exercise_id === latestSe.id &&
        !s.deleted_at &&
        !s.is_warmup,
    )
    .sort((a, b) => a.set_index - b.set_index);
}

/**
 * Summarize a completed (or in-progress) session:
 *   - durationMs: null if ended_at is missing.
 *   - effectiveSets: count of working sets in this session.
 *   - volumeByMuscle: fractional contribution per muscle using musclesBySeId
 *     (a map from session_exercise_id → muscles, pre-built by the caller).
 *   - prSetIds: IDs of sets in this session that triggered a PR versus
 *     the exercise history from OTHER sessions.
 *
 * @param session         - The session row.
 * @param sessionExercises - Snapshot filtered to this session (or the full map).
 * @param sets             - Snapshot of all sets.
 * @param allSessions      - Full sessions snapshot (for getLastSets history).
 * @param musclesBySeId    - Map: session_exercise_id → muscle contributions.
 *                           Key space: session_exercise_id (not exercise_id), so
 *                           the caller must build it from session_exercises.
 */
export function summarizeSession(
  session: WorkoutSessionRow,
  sessionExercises: Record<string, SessionExerciseRow>,
  sets: Record<string, SetRow>,
  allSessions: Record<string, WorkoutSessionRow>,
  musclesBySeId: MusclesBySessionExerciseId,
): SessionSummary {
  // TKT-0011: duration is real active time (excludes backgrounded intervals).
  // accumulated_active_seconds is the source of truth; fall back to the legacy
  // wall-clock computation only for pre-fix rows where it is 0/absent.
  const durationMs =
    session.accumulated_active_seconds && session.accumulated_active_seconds > 0
      ? session.accumulated_active_seconds * 1000
      : session.started_at && session.ended_at
        ? new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()
        : null;

  // Collect sets for this session
  const seIdsForSession = new Set<string>(
    Object.values(sessionExercises)
      .filter((se) => se.session_id === session.id && !se.deleted_at)
      .map((se) => se.id),
  );

  const sessionSets = Object.values(sets).filter(
    (s) => seIdsForSession.has(s.session_exercise_id) && !s.deleted_at,
  );

  const workingSets = sessionSets.filter((s) => !s.is_warmup);

  // Check PRs for each working set against history from OTHER sessions, then
  // keep at most ONE PR per exercise — the set with the highest estimated 1RM.
  // Without this dedup, several sets in the same session each beat the
  // (current-session-excluded) history and the summary lists the same exercise
  // multiple times (e.g. two identical "7.5 × 5" entries). See TKT-0012.
  const bestPrByExercise = new Map<string, { setId: string; e1rm: number }>();
  for (const set of workingSets) {
    if (set.reps == null || set.reps < 1 || set.weight_kg == null) continue;

    // Find exercise_id via session_exercise
    const se = sessionExercises[set.session_exercise_id];
    if (!se) continue;

    const history = getExerciseHistorySets(sets, sessionExercises, se.exercise_id, {
      excludeSessionId: session.id,
    });

    const { is1RM, isRepPR } = detectPR(set, history);
    if (!is1RM && !isRepPR) continue;

    const e1rm = estimated1RM(set.weight_kg, set.reps);
    const current = bestPrByExercise.get(se.exercise_id);
    if (!current || e1rm > current.e1rm) {
      bestPrByExercise.set(se.exercise_id, { setId: set.id, e1rm });
    }
  }
  const prSetIds = Array.from(bestPrByExercise.values()).map((v) => v.setId);

  return {
    durationMs,
    effectiveSets: effectiveSetCount(sessionSets),
    tonnageKg: tonnage(sessionSets),
    volumeByMuscle: fractionalVolumeByMuscle(sessionSets, musclesBySeId),
    prSetIds,
  };
}

// ---------------------------------------------------------------------------
// Profile preference helpers
// ---------------------------------------------------------------------------

/**
 * Read the user's preferred unit from the profiles snapshot.
 * Returns 'kg' as fallback if the profile is not yet loaded.
 */
export function getUserUnitPreference(
  profiles: Record<string, import('@/db').ProfileRow>,
  userId: string,
): import('@/db').UnitEnum {
  return profiles[userId]?.unit_preference ?? 'kg';
}

/**
 * Read the user's default failure metric from the profiles snapshot.
 * Returns 'rir' as fallback if the profile is not yet loaded.
 */
export function getUserDefaultFailureMetric(
  profiles: Record<string, import('@/db').ProfileRow>,
  userId: string,
): import('@/db').FailureMetricEnum {
  return profiles[userId]?.default_failure_metric ?? 'rir';
}
