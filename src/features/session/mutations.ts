/**
 * Session feature — mutation functions.
 *
 * All writes go through Legend-State observables (local-first, syncs offline).
 * Never call Supabase directly from here.
 *
 * Write pattern (same as src/db/sync.ts and src/features/catalog/queries.ts):
 *   (collection$ as any)[id].set(row)
 *
 * IDs: client-generated uuid via generateId() from @/db.
 * Timestamps: ISO strings from new Date().toISOString().
 * Soft delete: softDelete() helper from @/db.
 * Weight: caller passes weight_value + weight_unit; we compute weight_kg via
 *         toCanonicalKg() from @/lib/hypertrophy.
 */

import {
  generateId,
  softDelete,
  type UserObservables,
  type WorkoutSessionRow,
  type SessionExerciseRow,
  type SetRow,
  type FailureMetricEnum,
  type UnitEnum,
} from '@/db';
import { toCanonicalKg } from '@/lib/hypertrophy';
import { getActiveSession, getSessionExercises, getSetsForSessionExercise } from './queries';

// ---------------------------------------------------------------------------
// Input/result types
// ---------------------------------------------------------------------------

export interface StartSessionOptions {
  /** Override for the session's started_at (ISO string). Defaults to now. */
  startedAt?: string;
  /** Session name override. Defaults to the routine name (if any). */
  name?: string;
}

export interface AddSetInput {
  userId: string;
  /** Weight as typed by the user (display value). */
  weight_value: number | null;
  /** Unit the user typed in. */
  weight_unit: UnitEnum | null;
  reps: number | null;
  failure_metric?: FailureMetricEnum;
  rir?: number | null;
  rpe?: number | null;
  is_warmup?: boolean;
  reached_failure?: boolean;
  rest_seconds?: number | null;
  performed_at?: string;
  /**
   * Flexible extensible metadata stored in the sets.metadata jsonb column.
   * Use this for notes, tempo, per-rep RPE, etc. — no schema migration needed.
   * Example: { notes: 'felt heavy', tempo: '3-1-1' }
   */
  metadata?: Record<string, unknown>;
}

export interface UpdateSetInput {
  weight_value?: number | null;
  weight_unit?: UnitEnum | null;
  reps?: number | null;
  failure_metric?: FailureMetricEnum;
  rir?: number | null;
  rpe?: number | null;
  is_warmup?: boolean;
  reached_failure?: boolean;
  rest_seconds?: number | null;
  performed_at?: string;
  /**
   * Flexible extensible metadata stored in the sets.metadata jsonb column.
   * Use this for notes, tempo, per-rep RPE, etc. — no schema migration needed.
   */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Start a workout session from a saved routine.
 *
 * Creates:
 *   1. One workout_session (status 'in_progress').
 *   2. One session_exercise for each routine_exercise (order_index preserved).
 *   3. Sets started_at on the first session_exercise (exercise timer starts).
 *
 * Returns the new session id.
 *
 * Timer note: per-exercise duration is derived from started_at / ended_at.
 * started_at is set here for the first exercise; subsequent exercises get it
 * from goToNextExercise().
 */
export function startSessionFromRoutine(
  db: UserObservables,
  routine: import('@/db').RoutineRow,
  routineExercises: import('@/db').RoutineExerciseRow[],
  opts?: StartSessionOptions,
): string {
  const now = new Date().toISOString();
  const startedAt = opts?.startedAt ?? now;
  const sessionId = generateId();

  const sessionRow: WorkoutSessionRow = {
    id: sessionId,
    user_id: routine.user_id,
    routine_id: routine.id,
    name: opts?.name ?? routine.name,
    started_at: startedAt,
    ended_at: null,
    accumulated_active_seconds: 0,
    status: 'in_progress',
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  // Cast to any: Legend-State Observable<Record<string,T>> does not carry a
  // string index signature at the TS level; the runtime proxy supports it.
  (db.workoutSessions$ as any)[sessionId].set(sessionRow);

  // Create session_exercises from routine_exercises (sorted by order_index)
  const sorted = [...routineExercises]
    .filter((re) => !re.deleted_at)
    .sort((a, b) => a.order_index - b.order_index);

  sorted.forEach((re, idx) => {
    const seId = generateId();
    const seRow: SessionExerciseRow = {
      id: seId,
      user_id: routine.user_id,
      session_id: sessionId,
      exercise_id: re.exercise_id,
      order_index: re.order_index,
      // First exercise gets started_at immediately so its timer begins
      started_at: idx === 0 ? startedAt : null,
      ended_at: null,
      superset_group: null,
      superset_order: null,
      notes: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    (db.sessionExercises$ as any)[seId].set(seRow);
  });

  return sessionId;
}

/**
 * Start an empty session (no routine).  Useful for ad-hoc workouts and as
 * the primitive used by createRetroactiveSession().
 *
 * Returns the new session id.
 */
export function startEmptySession(
  db: UserObservables,
  userId: string,
  opts?: StartSessionOptions,
): string {
  const now = new Date().toISOString();
  const startedAt = opts?.startedAt ?? now;
  const sessionId = generateId();

  const sessionRow: WorkoutSessionRow = {
    id: sessionId,
    user_id: userId,
    routine_id: null,
    name: opts?.name ?? null,
    started_at: startedAt,
    ended_at: null,
    accumulated_active_seconds: 0,
    status: 'in_progress',
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  (db.workoutSessions$ as any)[sessionId].set(sessionRow);
  return sessionId;
}

/**
 * Create a new in-progress session that replicates the exercise list
 * (but NOT the sets) of the most recent completed session.
 *
 * Exercises are copied in order_index order with fresh IDs.
 * The first exercise gets started_at = now.
 * Returns the new session id, or null if there is no completed session.
 *
 * Tracking.md: "repeat last workout" — clone session's exercises, no sets.
 */
export function repeatLastSession(
  db: UserObservables,
  userId: string,
  opts?: StartSessionOptions,
): string | null {
  const sessionsSnapshot: Record<string, WorkoutSessionRow> =
    (db.workoutSessions$ as any).peek?.() ?? (db.workoutSessions$ as any).get?.() ?? {};

  // Find the most recent completed session for this user
  const completed = Object.values(sessionsSnapshot)
    .filter((s) => s.status === 'completed' && !s.deleted_at && s.user_id === userId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  if (completed.length === 0) return null;
  const lastSession = completed[0]!;

  const seSnapshot: Record<string, SessionExerciseRow> =
    (db.sessionExercises$ as any).peek?.() ?? (db.sessionExercises$ as any).get?.() ?? {};

  const lastExercises = getSessionExercises(seSnapshot, lastSession.id);

  const now = new Date().toISOString();
  const startedAt = opts?.startedAt ?? now;
  const sessionId = generateId();

  const sessionRow: WorkoutSessionRow = {
    id: sessionId,
    user_id: userId,
    routine_id: lastSession.routine_id,
    name: opts?.name ?? lastSession.name,
    started_at: startedAt,
    ended_at: null,
    accumulated_active_seconds: 0,
    status: 'in_progress',
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  (db.workoutSessions$ as any)[sessionId].set(sessionRow);

  lastExercises.forEach((se, idx) => {
    const seId = generateId();
    const seRow: SessionExerciseRow = {
      id: seId,
      user_id: userId,
      session_id: sessionId,
      exercise_id: se.exercise_id,
      order_index: se.order_index,
      started_at: idx === 0 ? startedAt : null,
      ended_at: null,
      superset_group: null,
      superset_order: null,
      notes: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    (db.sessionExercises$ as any)[seId].set(seRow);
  });

  return sessionId;
}

/**
 * Create a retroactive session — same as startEmptySession but startedAt is
 * explicitly in the past.  The UI sets startedAt; this is just a named alias
 * that makes the intent clear and enables future validation.
 *
 * Tracking.md: "you can create a workout with a past date and edit saved sets
 * (fix mistakes or omissions). started_at editable."
 */
export function createRetroactiveSession(
  db: UserObservables,
  userId: string,
  opts: StartSessionOptions & { startedAt: string },
): string {
  return startEmptySession(db, userId, opts);
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

/**
 * Add a new set to a session_exercise.
 *
 * set_index is assigned as (max existing set_index + 1), so the new set
 * always appears at the end.  Weight dual-storage: we compute weight_kg from
 * weight_value + weight_unit.
 *
 * Returns the new set id.
 */
export function addSet(
  db: UserObservables,
  sessionExerciseId: string,
  input: AddSetInput,
): string {
  const setsSnapshot: Record<string, SetRow> =
    (db.sets$ as any).peek?.() ?? (db.sets$ as any).get?.() ?? {};

  // Determine next set_index (contiguous, 0-based)
  const existingSets = getSetsForSessionExercise(setsSnapshot, sessionExerciseId);
  const nextIndex =
    existingSets.length > 0
      ? Math.max(...existingSets.map((s) => s.set_index)) + 1
      : 0;

  const now = new Date().toISOString();
  const id = generateId();

  const weightKg =
    input.weight_value != null && input.weight_unit != null
      ? toCanonicalKg(input.weight_value, input.weight_unit)
      : null;

  const row: SetRow = {
    id,
    user_id: input.userId,
    session_exercise_id: sessionExerciseId,
    set_index: nextIndex,
    weight_value: input.weight_value ?? null,
    weight_unit: input.weight_unit ?? null,
    weight_kg: weightKg,
    reps: input.reps ?? null,
    failure_metric: input.failure_metric ?? 'none',
    rir: input.rir ?? null,
    rpe: input.rpe ?? null,
    is_warmup: input.is_warmup ?? false,
    reached_failure: input.reached_failure ?? false,
    rest_seconds: input.rest_seconds ?? null,
    drop_group: null,
    drop_order: null,
    performed_at: input.performed_at ?? now,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  (db.sets$ as any)[id].set(row);
  return id;
}

/**
 * Duplicate an existing set (append to the same session_exercise).
 * All fields are copied except id, set_index, performed_at, created_at,
 * and updated_at.
 *
 * Returns the new set id.
 */
export function duplicateSet(db: UserObservables, set: SetRow): string {
  const setsSnapshot: Record<string, SetRow> =
    (db.sets$ as any).peek?.() ?? (db.sets$ as any).get?.() ?? {};

  const existingSets = getSetsForSessionExercise(setsSnapshot, set.session_exercise_id);
  const nextIndex =
    existingSets.length > 0
      ? Math.max(...existingSets.map((s) => s.set_index)) + 1
      : 0;

  const now = new Date().toISOString();
  const id = generateId();

  const row: SetRow = {
    ...set,
    id,
    set_index: nextIndex,
    performed_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  (db.sets$ as any)[id].set(row);
  return id;
}

/**
 * Update fields of an existing set.
 *
 * If weight_value or weight_unit is in the patch, weight_kg is recomputed.
 * set_index is NOT patchable here — use reorderSets() if reordering is needed.
 *
 * updated_at is always bumped.
 */
export function updateSet(
  db: UserObservables,
  setId: string,
  patch: UpdateSetInput,
): void {
  const now = new Date().toISOString();
  (db.sets$ as any)[setId].set((prev: SetRow) => {
    const newWeightValue =
      'weight_value' in patch ? patch.weight_value ?? null : prev.weight_value;
    const newWeightUnit =
      'weight_unit' in patch ? patch.weight_unit ?? null : prev.weight_unit;
    const newWeightKg =
      newWeightValue != null && newWeightUnit != null
        ? toCanonicalKg(newWeightValue, newWeightUnit)
        : prev.weight_kg;

    return {
      ...prev,
      weight_value: newWeightValue,
      weight_unit: newWeightUnit,
      weight_kg: newWeightKg,
      reps: 'reps' in patch ? (patch.reps ?? null) : prev.reps,
      failure_metric: patch.failure_metric ?? prev.failure_metric,
      rir: 'rir' in patch ? (patch.rir ?? null) : prev.rir,
      rpe: 'rpe' in patch ? (patch.rpe ?? null) : prev.rpe,
      is_warmup: patch.is_warmup !== undefined ? patch.is_warmup : prev.is_warmup,
      reached_failure:
        patch.reached_failure !== undefined ? patch.reached_failure : prev.reached_failure,
      rest_seconds: 'rest_seconds' in patch ? (patch.rest_seconds ?? null) : prev.rest_seconds,
      performed_at: patch.performed_at ?? prev.performed_at,
      metadata: patch.metadata ?? prev.metadata,
      updated_at: now,
    };
  });
}

/**
 * Soft-delete a set.
 * set_index gaps are acceptable — queries sort by set_index, so display is
 * unaffected.  If strict contiguity is required later, call a reindex helper.
 */
export function deleteSet(db: UserObservables, setId: string): void {
  softDelete(db.sets$, setId);
}

// ---------------------------------------------------------------------------
// Exercise navigation
// ---------------------------------------------------------------------------

/**
 * Advance to the next exercise in the session.
 *
 * Records:
 *   - currentSessionExercise.ended_at = now  (closes the exercise timer)
 *   - nextSessionExercise.started_at = now   (opens the next exercise timer)
 *
 * If nextSessionExerciseId is null (last exercise → finishing), only current
 * is closed.
 *
 * Tracking.md: "moving on closes the current exercise and saves its duration"
 */
export function goToNextExercise(
  db: UserObservables,
  _sessionId: string,
  currentSessionExerciseId: string,
  nextSessionExerciseId: string | null,
): void {
  const now = new Date().toISOString();

  // Close current exercise
  (db.sessionExercises$ as any)[currentSessionExerciseId].set(
    (prev: SessionExerciseRow) => ({
      ...prev,
      ended_at: prev.ended_at ?? now,
      updated_at: now,
    }),
  );

  // Open next exercise (if any)
  if (nextSessionExerciseId) {
    (db.sessionExercises$ as any)[nextSessionExerciseId].set(
      (prev: SessionExerciseRow) => ({
        ...prev,
        started_at: prev.started_at ?? now,
        updated_at: now,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Mid-session exercise management
// ---------------------------------------------------------------------------

/**
 * Add an exercise to an in-progress session.
 *
 * order_index is set to (max existing + 1) to append at the end.
 * Returns the new session_exercise id.
 *
 * Tracking.md: "Secondary actions (⋮ menu): add/swap/skip an exercise on the fly."
 */
export function addExerciseToSession(
  db: UserObservables,
  sessionId: string,
  exerciseId: string,
  userId: string,
): string {
  const seSnapshot: Record<string, SessionExerciseRow> =
    (db.sessionExercises$ as any).peek?.() ?? (db.sessionExercises$ as any).get?.() ?? {};

  const existing = getSessionExercises(seSnapshot, sessionId);
  const nextIndex =
    existing.length > 0 ? Math.max(...existing.map((se) => se.order_index)) + 1 : 0;

  const now = new Date().toISOString();
  const id = generateId();

  const row: SessionExerciseRow = {
    id,
    user_id: userId,
    session_id: sessionId,
    exercise_id: exerciseId,
    order_index: nextIndex,
    started_at: null,
    ended_at: null,
    superset_group: null,
    superset_order: null,
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  (db.sessionExercises$ as any)[id].set(row);
  return id;
}

/**
 * Replace the exercise on an existing session_exercise row in place.
 * order_index, timing, and superset grouping are preserved.
 * Any existing sets for the old exercise are NOT deleted (user may want to keep them).
 *
 * Returns the updated session_exercise id (same as input).
 */
export function swapExercise(
  db: UserObservables,
  sessionExerciseId: string,
  newExerciseId: string,
): void {
  const now = new Date().toISOString();
  (db.sessionExercises$ as any)[sessionExerciseId].set(
    (prev: SessionExerciseRow) => ({
      ...prev,
      exercise_id: newExerciseId,
      updated_at: now,
    }),
  );
}

/**
 * Skip (soft-delete) a session_exercise mid-session.
 * Sets ended_at = now (closes the exercise timer) then soft-deletes the row.
 * Leaves order_index gaps; queries sort+filter so display is unaffected.
 */
export function skipExercise(db: UserObservables, sessionExerciseId: string): void {
  const now = new Date().toISOString();
  // Close the exercise timer first (no-op if already closed)
  (db.sessionExercises$ as any)[sessionExerciseId].set(
    (prev: SessionExerciseRow) => ({
      ...prev,
      ended_at: prev.ended_at ?? now,
      updated_at: now,
    }),
  );
  softDelete(db.sessionExercises$, sessionExerciseId);
}

// ---------------------------------------------------------------------------
// Superset grouping
// ---------------------------------------------------------------------------

/**
 * Group a list of session_exercise rows as a superset.
 *
 * Assigns the same superset_group (new uuid) and sequential superset_order
 * (0-based, following the provided order of IDs).
 *
 * Architecture.md: "superset_group (uuid) + superset_order (int). session_exercises
 * sharing superset_group are performed together (alternating). null = normal exercise."
 */
export function groupAsSuperset(
  db: UserObservables,
  sessionExerciseIds: string[],
): string {
  const groupId = generateId();
  const now = new Date().toISOString();

  sessionExerciseIds.forEach((id, idx) => {
    (db.sessionExercises$ as any)[id].set((prev: SessionExerciseRow) => ({
      ...prev,
      superset_group: groupId,
      superset_order: idx,
      updated_at: now,
    }));
  });

  return groupId;
}

/**
 * Remove an exercise from its superset (clears superset_group + superset_order).
 */
export function removeFromSuperset(db: UserObservables, sessionExerciseId: string): void {
  const now = new Date().toISOString();
  (db.sessionExercises$ as any)[sessionExerciseId].set((prev: SessionExerciseRow) => ({
    ...prev,
    superset_group: null,
    superset_order: null,
    updated_at: now,
  }));
}

// ---------------------------------------------------------------------------
// Dropset grouping
// ---------------------------------------------------------------------------

/**
 * Group a list of set rows as a dropset.
 *
 * Assigns the same drop_group (new uuid) and sequential drop_order (0-based,
 * following the provided order of IDs).
 *
 * Architecture.md: "drop_group (uuid) + drop_order (int). sets sharing drop_group
 * form a dropset (same exercise, chained drops). null = normal set."
 */
export function groupSetsAsDropset(
  db: UserObservables,
  setIds: string[],
): string {
  const groupId = generateId();
  const now = new Date().toISOString();

  setIds.forEach((id, idx) => {
    (db.sets$ as any)[id].set((prev: SetRow) => ({
      ...prev,
      drop_group: groupId,
      drop_order: idx,
      updated_at: now,
    }));
  });

  return groupId;
}

/**
 * Remove a set from its dropset (clears drop_group + drop_order).
 */
export function removeFromDropset(db: UserObservables, setId: string): void {
  const now = new Date().toISOString();
  (db.sets$ as any)[setId].set((prev: SetRow) => ({
    ...prev,
    drop_group: null,
    drop_order: null,
    updated_at: now,
  }));
}

// ---------------------------------------------------------------------------
// Finish session
// ---------------------------------------------------------------------------

/**
 * Mark a session as completed.
 *
 * Sets:
 *   - status = 'completed'
 *   - ended_at = now
 *   - updated_at = now
 *
 * Also ensures the last session_exercise has ended_at set (in case the user
 * finished without pressing "Next exercise" on the last one).
 *
 * Tracking.md: "Finish workout → status = completed, sets ended_at."
 */
export function finishSession(db: UserObservables, sessionId: string): void {
  const now = new Date().toISOString();

  // Close any session_exercise that hasn't been closed yet
  const seSnapshot: Record<string, SessionExerciseRow> =
    (db.sessionExercises$ as any).peek?.() ?? (db.sessionExercises$ as any).get?.() ?? {};

  const sessionExercises = getSessionExercises(seSnapshot, sessionId);
  for (const se of sessionExercises) {
    if (se.started_at && !se.ended_at) {
      (db.sessionExercises$ as any)[se.id].set((prev: SessionExerciseRow) => ({
        ...prev,
        ended_at: now,
        updated_at: now,
      }));
    }
  }

  // Mark session completed
  (db.workoutSessions$ as any)[sessionId].set((prev: WorkoutSessionRow) => ({
    ...prev,
    status: 'completed' as const,
    ended_at: prev.ended_at ?? now,
    updated_at: now,
  }));
}

// ---------------------------------------------------------------------------
// Session patch
// ---------------------------------------------------------------------------

export interface UpdateSessionInput {
  started_at?: string;
  name?: string;
  notes?: string;
}

/**
 * Update mutable fields of a workout session.
 *
 * Bumps updated_at on every write. All fields are optional; supply only
 * the fields you want to change.
 */
export function updateSession(
  db: UserObservables,
  sessionId: string,
  patch: UpdateSessionInput,
): void {
  const now = new Date().toISOString();
  (db.workoutSessions$ as any)[sessionId].set((prev: WorkoutSessionRow) => ({
    ...prev,
    ...(patch.started_at !== undefined ? { started_at: patch.started_at } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    updated_at: now,
  }));
}

// ---------------------------------------------------------------------------
// Active-time accumulator (TKT-0011)
// ---------------------------------------------------------------------------

/**
 * Add a segment of real active time to a session's accumulator.
 *
 * Called by the session-timer hook on every foreground→background transition
 * (and on finish/unmount) with the seconds elapsed while the app was in the
 * foreground. Background time is therefore never added. The write persists to
 * the local SQLite layer, so a crash mid-session recovers the last committed
 * value rather than recomputing from started_at.
 *
 * deltaSeconds <= 0 is a no-op (avoids spurious updated_at bumps).
 */
export function addActiveTime(
  db: UserObservables,
  sessionId: string,
  deltaSeconds: number,
): void {
  const delta = Math.floor(deltaSeconds);
  if (!Number.isFinite(delta) || delta <= 0) return;
  const now = new Date().toISOString();
  (db.workoutSessions$ as any)[sessionId].set((prev: WorkoutSessionRow) => ({
    ...prev,
    accumulated_active_seconds: Math.max(0, (prev.accumulated_active_seconds ?? 0) + delta),
    updated_at: now,
  }));
}

/**
 * Overwrite a session's accumulated active time with an absolute value.
 *
 * Used by the stale-session recovery flow ("Finish with real duration"), where
 * the user supplies the real elapsed time after the timer was inflated by a
 * long background gap. Clamps to >= 0.
 */
export function setActiveTime(
  db: UserObservables,
  sessionId: string,
  seconds: number,
): void {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const now = new Date().toISOString();
  (db.workoutSessions$ as any)[sessionId].set((prev: WorkoutSessionRow) => ({
    ...prev,
    accumulated_active_seconds: value,
    updated_at: now,
  }));
}

// ---------------------------------------------------------------------------
// TKT-0030: Manual duration edit
// ---------------------------------------------------------------------------

/**
 * Update a session's duration by setting ended_at = started_at + newDurationSeconds.
 *
 * Also clears accumulated_active_seconds so the explicit override becomes the
 * canonical value (summarizeSession prefers accumulated_active_seconds > 0).
 *
 * Validations are the caller's responsibility (parseDurationInput in summaryHelpers).
 */
export function updateSessionDuration(
  db: UserObservables,
  sessionId: string,
  newDurationSeconds: number,
): void {
  const now = new Date().toISOString();
  (db.workoutSessions$ as any)[sessionId].set((prev: WorkoutSessionRow) => {
    const startedMs = new Date(prev.started_at).getTime();
    const newEndedAt = new Date(startedMs + newDurationSeconds * 1000).toISOString();
    return {
      ...prev,
      ended_at: newEndedAt,
      // Zero out the accumulator so summarizeSession uses ended_at - started_at
      accumulated_active_seconds: newDurationSeconds,
      updated_at: now,
    };
  });
}

// ---------------------------------------------------------------------------
// TKT-0020: Mid-session exercise reorder
// ---------------------------------------------------------------------------

/**
 * Batch-update order_index for all session_exercise rows to match a new
 * ordering supplied as an ordered array of IDs.
 *
 * Runs all writes in a single synchronous batch so Legend-State / MMKV
 * never sees a partial re-order.
 *
 * @param db              UserObservables context.
 * @param orderedIds      Array of session_exercise IDs in the desired order
 *                        (index 0 = first exercise displayed).
 */
export function reorderSessionExercises(
  db: UserObservables,
  orderedIds: string[],
): void {
  const now = new Date().toISOString();
  orderedIds.forEach((id, idx) => {
    (db.sessionExercises$ as any)[id].set((prev: SessionExerciseRow) => ({
      ...prev,
      order_index: idx,
      updated_at: now,
    }));
  });
}

// ---------------------------------------------------------------------------
// Active session guard
// ---------------------------------------------------------------------------

/**
 * Convenience: return the current in-progress session id, or null.
 * Reads the observable snapshot synchronously via peek().
 * Used by the UI to decide whether to offer "resume" or "start new".
 */
export function getActiveSessionId(db: UserObservables): string | null {
  const snapshot: Record<string, WorkoutSessionRow> =
    (db.workoutSessions$ as any).peek?.() ?? (db.workoutSessions$ as any).get?.() ?? {};
  return getActiveSession(snapshot)?.id ?? null;
}
