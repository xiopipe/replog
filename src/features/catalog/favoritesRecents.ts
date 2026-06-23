/**
 * Pure helpers for Favorites + Recents (TKT-0039).
 *
 * No React Native, no Legend-State imports — pure data transforms
 * on record snapshots for easy unit testing.
 */

import type {
  ExerciseFavoriteRow,
  ExerciseRow,
  SessionExerciseRow,
  WorkoutSessionRow,
  EquipmentEnum,
  ExerciseMuscleRow,
  MuscleEnum,
} from '@/db';

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

/**
 * Return the set of exercise_ids the user has favorited.
 */
export function getFavoriteExerciseIds(
  favorites: Record<string, ExerciseFavoriteRow>,
): Set<string> {
  const ids = new Set<string>();
  for (const fav of Object.values(favorites)) {
    ids.add(fav.exercise_id);
  }
  return ids;
}

/**
 * Find the favorite row for a given exercise_id, or null if not favorited.
 */
export function findFavoriteRow(
  favorites: Record<string, ExerciseFavoriteRow>,
  exerciseId: string,
): ExerciseFavoriteRow | null {
  for (const fav of Object.values(favorites)) {
    if (fav.exercise_id === exerciseId) return fav;
  }
  return null;
}

/**
 * Build a new ExerciseFavoriteRow to insert when toggling favorite on.
 * The caller must supply a UUID (use generateId() from @/db at the call site).
 */
export function buildFavoriteRow(
  userId: string,
  exerciseId: string,
  id: string,
): ExerciseFavoriteRow {
  return {
    id,
    user_id: userId,
    exercise_id: exerciseId,
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Recents
// ---------------------------------------------------------------------------

/**
 * Return the last N distinct exercise IDs the user has used across sessions,
 * ordered by most-recent use (based on session started_at).
 *
 * Join path: session_exercises (exercise_id, session_id) + workout_sessions (started_at).
 * Excludes soft-deleted session_exercises and sessions.
 *
 * @param sessionExercises - Snapshot of the session_exercises observable.
 * @param sessions         - Snapshot of the workout_sessions observable.
 * @param limit            - Max distinct exercises to return (default 5).
 */
export function getRecentExerciseIds(
  sessionExercises: Record<string, SessionExerciseRow>,
  sessions: Record<string, WorkoutSessionRow>,
  limit = 5,
): string[] {
  // Collect { exercise_id, started_at } for every non-deleted session_exercise
  // whose session is not deleted.
  type Entry = { exerciseId: string; startedAt: string };
  const entries: Entry[] = [];

  for (const se of Object.values(sessionExercises)) {
    if (se.deleted_at) continue;
    const session = sessions[se.session_id];
    if (!session || session.deleted_at) continue;
    entries.push({ exerciseId: se.exercise_id, startedAt: session.started_at });
  }

  // Sort by most recent first
  entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  // Deduplicate preserving order, limit to N
  const seen = new Set<string>();
  const result: string[] = [];
  for (const { exerciseId } of entries) {
    if (seen.has(exerciseId)) continue;
    seen.add(exerciseId);
    result.push(exerciseId);
    if (result.length >= limit) break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Filter helpers (apply muscle/equipment filter to a list of exercise IDs)
// ---------------------------------------------------------------------------

/**
 * Filter a list of exercise IDs by the active muscle and/or equipment filter.
 * Returns only exercise IDs whose exercise passes all active filters.
 *
 * @param exerciseIds    - Ordered list of exercise IDs to filter.
 * @param exercises      - Combined global + user exercise map.
 * @param muscles        - Combined global + user exercise_muscles map.
 * @param filterMuscle   - Active muscle filter (null = no filter).
 * @param filterEquipment - Active equipment filter (null = no filter).
 */
export function filterExerciseIdsByFilters(
  exerciseIds: string[],
  exercises: Record<string, ExerciseRow>,
  muscles: Record<string, ExerciseMuscleRow>,
  filterMuscle: MuscleEnum | null,
  filterEquipment: EquipmentEnum | null,
): string[] {
  if (!filterMuscle && !filterEquipment) return exerciseIds;

  // Build muscle lookup: exercise_id → Set<muscle>
  const musclesByExercise = new Map<string, Set<string>>();
  for (const m of Object.values(muscles)) {
    let s = musclesByExercise.get(m.exercise_id);
    if (!s) { s = new Set(); musclesByExercise.set(m.exercise_id, s); }
    s.add(m.muscle);
  }

  return exerciseIds.filter((id) => {
    const ex = exercises[id];
    if (!ex || ex.deleted_at) return false;
    if (filterEquipment && ex.category !== filterEquipment) return false;
    if (filterMuscle) {
      const ms = musclesByExercise.get(id);
      if (!ms || !ms.has(filterMuscle)) return false;
    }
    return true;
  });
}
