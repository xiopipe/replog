/**
 * Catalog feature — data access helpers.
 *
 * All reads go through the Legend-State observables (local SQLite);
 * the UI never waits on the network.
 *
 * Naming:
 *   get*  — pure selector functions (not hooks) that accept plain record maps.
 *   create* — mutation functions that write to user observables.
 */

import {
  generateId,
  type UserObservables,
  type EquipmentEnum,
  type ExerciseMuscleRow,
  type ExerciseRow,
  type MuscleEnum,
  type MuscleRoleEnum,
} from '@/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExerciseMuscleInfo {
  muscle: MuscleEnum;
  role: MuscleRoleEnum;
  contribution: number;
}

export interface ExerciseWithMuscles extends ExerciseRow {
  muscles: ExerciseMuscleInfo[];
}

export interface CreateExerciseInput {
  name: string;
  category: EquipmentEnum;
  isBodyweight: boolean;
  instructions: string | null;
  primaryMuscles: MuscleEnum[];
  secondaryMuscles: MuscleEnum[];
  userId: string;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Merge global + user exercises (exclude soft-deleted),
 * optionally filtered by search text and/or muscle group.
 *
 * @param globalExercises  - Record from globalExercises$ observable
 * @param userExercises    - Record from db.userExercises$ observable (or {})
 * @param globalMuscles    - Record from globalExerciseMuscles$ observable
 * @param userMuscles      - Record from db.userExerciseMuscles$ observable (or {})
 * @param search           - Case-insensitive substring to match against name
 * @param filterMuscle     - If set, only exercises that include this muscle group
 * @param filterEquipment  - If set, only exercises with this equipment category (AND with filterMuscle)
 */
export function getFilteredExercises(
  globalExercises: Record<string, ExerciseRow>,
  userExercises: Record<string, ExerciseRow>,
  globalMuscles: Record<string, ExerciseMuscleRow>,
  userMuscles: Record<string, ExerciseMuscleRow>,
  search: string,
  filterMuscle: MuscleEnum | null,
  filterEquipment: EquipmentEnum | null = null,
): ExerciseWithMuscles[] {
  // Merge and exclude soft-deleted
  const allExercises: ExerciseRow[] = [
    ...Object.values(globalExercises),
    ...Object.values(userExercises),
  ].filter((e) => !e.deleted_at);

  // Build a lookup: exercise_id → muscles
  // TKT-0066: globalMuscles and userMuscles are now disjoint (each observable
  // filters by user_id IS NULL vs user_id = uid via the exercise_muscles_with_user
  // view). No client-side dedup is needed.
  const allMuscles: ExerciseMuscleRow[] = [
    ...Object.values(globalMuscles),
    ...Object.values(userMuscles),
  ];
  const musclesByExercise: Record<string, ExerciseMuscleInfo[]> = {};
  for (const m of allMuscles) {
    if (!musclesByExercise[m.exercise_id]) {
      musclesByExercise[m.exercise_id] = [];
    }
    musclesByExercise[m.exercise_id].push({
      muscle: m.muscle,
      role: m.role,
      contribution: m.contribution,
    });
  }

  // Attach muscles + apply filters
  const searchLower = search.trim().toLowerCase();

  const result: ExerciseWithMuscles[] = [];
  for (const ex of allExercises) {
    const muscles = musclesByExercise[ex.id] ?? [];

    if (searchLower && !ex.name.toLowerCase().includes(searchLower)) {
      continue;
    }

    if (filterMuscle && !muscles.some((m) => m.muscle === filterMuscle)) {
      continue;
    }

    if (filterEquipment && ex.category !== filterEquipment) {
      continue;
    }

    result.push({ ...ex, muscles });
  }

  // Sort by name (locale-aware, Spanish)
  result.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return result;
}

/**
 * Get muscles for a single exercise_id (merges global + user muscle maps).
 *
 * TKT-0066: observables are now disjoint (filtered via exercise_muscles_with_user
 * view), so no dedup is required.
 */
export function getMusclesForExercise(
  globalMuscles: Record<string, ExerciseMuscleRow>,
  userMuscles: Record<string, ExerciseMuscleRow>,
  exerciseId: string,
): ExerciseMuscleInfo[] {
  const allMuscles: ExerciseMuscleRow[] = [
    ...Object.values(globalMuscles),
    ...Object.values(userMuscles),
  ];
  return allMuscles
    .filter((m) => m.exercise_id === exerciseId)
    .map((m) => ({ muscle: m.muscle, role: m.role, contribution: m.contribution }));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a custom exercise in the user's local observable store.
 * Writes are immediately visible offline; Legend-State syncs to Supabase.
 */
export function createCustomExercise(
  db: UserObservables,
  input: CreateExerciseInput,
): string {
  const now = new Date().toISOString();
  const exerciseId = generateId();

  const exerciseRow: ExerciseRow = {
    id: exerciseId,
    user_id: input.userId,
    name: input.name.trim(),
    category: input.category,
    is_custom: true,
    is_bodyweight: input.isBodyweight,
    instructions: input.instructions?.trim() || null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  // Write exercise row.
  // Cast to any: Legend-State's Observable<Record<string,T>> does not carry a string
  // index signature at the TS level, but the runtime proxy supports dynamic key access.
  (db.userExercises$ as any)[exerciseId].set(exerciseRow);

  // Write muscle rows
  const writeMuscle = (muscle: MuscleEnum, role: MuscleRoleEnum, contribution: number) => {
    const muscleId = generateId();
    const muscleRow: ExerciseMuscleRow = {
      id: muscleId,
      exercise_id: exerciseId,
      muscle,
      role,
      contribution,
      created_at: now,
      updated_at: now,
    };
    // Same cast rationale as userExercises$ above — dynamic-key proxy, no TS index signature.
    (db.userExerciseMuscles$ as any)[muscleId].set(muscleRow);
  };

  for (const muscle of input.primaryMuscles) {
    writeMuscle(muscle, 'primary', 1.0);
  }
  for (const muscle of input.secondaryMuscles) {
    writeMuscle(muscle, 'secondary', 0.5);
  }

  return exerciseId;
}
