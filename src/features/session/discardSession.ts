/**
 * discardSession — batch soft-delete a session with all its exercises and sets.
 * TKT-0049.
 *
 * Pure Legend-State write: sets deleted_at + updated_at on the session,
 * all its session_exercises, and all their sets in a single synchronous batch.
 * No Supabase calls — the sync plugin propagates to Postgres automatically.
 *
 * The 4-hour staleness threshold is shared with TKT-0011 (activeTime.ts) — do
 * NOT duplicate it here. Use STALE_SESSION_THRESHOLD_HOURS from activeTime.ts.
 */

import type { UserObservables, SessionExerciseRow, SetRow, WorkoutSessionRow } from '@/db';

/**
 * Soft-delete a session, all its session_exercises, and all their sets in one
 * Legend-State batch.
 *
 * Batch approach: all writes are synchronous (Legend-State internal batching).
 * The sync plugin will push the updates to Supabase in a single debounce cycle.
 */
export function discardSession(db: UserObservables, sessionId: string): void {
  const now = new Date().toISOString();

  // 1. Collect session_exercises belonging to this session.
  const seSnapshot: Record<string, SessionExerciseRow> =
    (db.sessionExercises$ as any).peek?.() ?? (db.sessionExercises$ as any).get?.() ?? {};

  const sessionExerciseIds: string[] = Object.values(seSnapshot)
    .filter((se) => se.session_id === sessionId && !se.deleted_at)
    .map((se) => se.id);

  // 2. Collect sets belonging to those session_exercises.
  const setsSnapshot: Record<string, SetRow> =
    (db.sets$ as any).peek?.() ?? (db.sets$ as any).get?.() ?? {};

  const setIds: string[] = Object.values(setsSnapshot)
    .filter((s) => sessionExerciseIds.includes(s.session_exercise_id) && !s.deleted_at)
    .map((s) => s.id);

  // 3. Soft-delete sets.
  for (const setId of setIds) {
    (db.sets$ as any)[setId].set((prev: SetRow) => ({
      ...prev,
      deleted_at: now,
      updated_at: now,
    }));
  }

  // 4. Soft-delete session_exercises.
  for (const seId of sessionExerciseIds) {
    (db.sessionExercises$ as any)[seId].set((prev: SessionExerciseRow) => ({
      ...prev,
      deleted_at: now,
      updated_at: now,
    }));
  }

  // 5. Soft-delete the session itself.
  (db.workoutSessions$ as any)[sessionId].set((prev: WorkoutSessionRow) => ({
    ...prev,
    deleted_at: now,
    updated_at: now,
  }));
}
