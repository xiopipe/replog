/**
 * Routines feature — pure selector functions.
 *
 * All functions accept plain observable snapshots (Record<string, Row>)
 * and return derived data. No side effects, no Legend-State imports needed here.
 */

import type {
  RoutineRow,
  RoutineExerciseRow,
  PlanRow,
  PlanDayRow,
  ExerciseRow,
} from '@/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutineExerciseWithExercise extends RoutineExerciseRow {
  exercise: ExerciseRow;
}

export interface RoutineWithExercises extends RoutineRow {
  exercises: RoutineExerciseWithExercise[];
}

/** Summary for a single weekday in the plan. weekday 0=Mon, 6=Sun */
export interface WeekdaySummary {
  weekday: number;
  planDay: PlanDayRow | null;
  routine: RoutineRow | null;
  exerciseCount: number;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Return all non-deleted routines sorted by name.
 */
export function getRoutines(routines: Record<string, RoutineRow>): RoutineRow[] {
  return Object.values(routines)
    .filter((r) => !r.deleted_at)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Return the exercises in a given routine, sorted by order_index.
 * Merges global + user exercises to resolve exercise_id.
 */
export function getRoutineExercises(
  routineExercises: Record<string, RoutineExerciseRow>,
  globalExercises: Record<string, ExerciseRow>,
  userExercises: Record<string, ExerciseRow>,
  routineId: string,
): RoutineExerciseWithExercise[] {
  const allExercises = { ...globalExercises, ...userExercises };

  return Object.values(routineExercises)
    .filter((re) => re.routine_id === routineId && !re.deleted_at)
    .sort((a, b) => a.order_index - b.order_index)
    .flatMap((re) => {
      const exercise = allExercises[re.exercise_id];
      if (!exercise || exercise.deleted_at) return [];
      return [{ ...re, exercise }];
    });
}

/**
 * Return the single active plan or null.
 */
export function getActivePlan(plans: Record<string, PlanRow>): PlanRow | null {
  for (const plan of Object.values(plans)) {
    if (plan.is_active && !plan.deleted_at) return plan;
  }
  return null;
}

/**
 * Build a 7-element array (Mon=0 .. Sun=6) with the plan day info for the active plan.
 */
export function getWeekdaySummaries(
  planDays: Record<string, PlanDayRow>,
  routines: Record<string, RoutineRow>,
  routineExercises: Record<string, RoutineExerciseRow>,
  activePlanId: string | null,
): WeekdaySummary[] {
  const summaries: WeekdaySummary[] = [];

  for (let day = 0; day < 7; day++) {
    const planDay = activePlanId
      ? Object.values(planDays).find(
          (pd) =>
            pd.plan_id === activePlanId &&
            pd.weekday === day &&
            !pd.deleted_at,
        ) ?? null
      : null;

    const routine = planDay ? (routines[planDay.routine_id] ?? null) : null;
    const deletedRoutine = routine?.deleted_at ? null : routine;

    const exerciseCount = deletedRoutine
      ? Object.values(routineExercises).filter(
          (re) => re.routine_id === deletedRoutine.id && !re.deleted_at,
        ).length
      : 0;

    summaries.push({
      weekday: day,
      planDay: planDay,
      routine: deletedRoutine,
      exerciseCount,
    });
  }

  return summaries;
}

/**
 * Build a target summary string for a routine exercise.
 * Returns one of:
 *   "X series · Y–Z reps"
 *   "X series · Y reps"   (if min === max)
 *   "X series · al fallo" (if reps null)
 *   "Y–Z reps"
 *   "Y reps"
 *   "Al fallo"
 *   ""   (no targets at all)
 */
export function buildTargetSummary(
  re: Pick<RoutineExerciseRow, 'target_sets' | 'target_reps_min' | 'target_reps_max'>,
  strings: {
    setsReps: (sets: number, min: number, max: number) => string;
    setsFixed: (sets: number, reps: number) => string;
    setsFailure: (sets: number) => string;
    reps: (reps: number, max: number) => string;
    failure: string;
    none: string;
  },
): string {
  const { target_sets, target_reps_min, target_reps_max } = re;

  const hasSets = target_sets != null;
  const hasReps = target_reps_min != null || target_reps_max != null;

  if (!hasSets && !hasReps) return strings.none;

  if (hasSets) {
    const s = target_sets!;
    if (!hasReps) return strings.setsFailure(s);
    const min = target_reps_min!;
    const max = target_reps_max ?? min;
    if (min === max) return strings.setsFixed(s, min);
    return strings.setsReps(s, min, max);
  }

  // No sets, has reps
  const min = target_reps_min!;
  const max = target_reps_max ?? min;
  if (min === 0 && max === 0) return strings.failure;
  return strings.reps(min, max);
}
