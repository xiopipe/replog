/**
 * Routines feature — mutation functions.
 *
 * All writes go through Legend-State observables (local-first, syncs offline).
 * Never call Supabase directly from here.
 *
 * Pattern for writing to a synced observable:
 *   (collection$ as any)[id].set(row)
 */

import {
  generateId,
  softDelete,
  type UserObservables,
  type RoutineRow,
  type RoutineExerciseRow,
  type PlanRow,
  type PlanDayRow,
} from '@/db';
import { selectOrphanIds } from './template-cleanup';

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export interface CreateRoutineInput {
  name: string;
  notes?: string | null;
  userId: string;
}

/**
 * Create a new empty routine. Returns the new routine id.
 */
export function createRoutine(db: UserObservables, input: CreateRoutineInput): string {
  const now = new Date().toISOString();
  const id = generateId();

  const row: RoutineRow = {
    id,
    user_id: input.userId,
    name: input.name.trim(),
    notes: input.notes?.trim() || null,
    source_template_id: null, // manually created — never auto-deleted on template change
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  (db.routines$ as any)[id].set(row);
  return id;
}

/**
 * Update a routine's name and/or notes in place.
 */
export function updateRoutine(
  db: UserObservables,
  routineId: string,
  patch: { name?: string; notes?: string | null },
): void {
  const now = new Date().toISOString();
  const obs = (db.routines$ as any)[routineId];
  obs.set((prev: RoutineRow) => ({
    ...prev,
    ...(patch.name !== undefined ? { name: patch.name!.trim() } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    updated_at: now,
  }));
}

/**
 * Soft-delete a routine (and its exercises are excluded by normal filter).
 */
export function deleteRoutine(db: UserObservables, routineId: string): void {
  softDelete(db.routines$, routineId);
}

// ---------------------------------------------------------------------------
// Routine exercises
// ---------------------------------------------------------------------------

export interface AddExerciseToRoutineInput {
  routineId: string;
  exerciseId: string;
  orderIndex: number;
  userId: string;
}

/**
 * Add an exercise to a routine at the given order_index. Returns the new row id.
 */
export function addExerciseToRoutine(
  db: UserObservables,
  input: AddExerciseToRoutineInput,
): string {
  const now = new Date().toISOString();
  const id = generateId();

  const row: RoutineExerciseRow = {
    id,
    user_id: input.userId,
    routine_id: input.routineId,
    exercise_id: input.exerciseId,
    order_index: input.orderIndex,
    target_sets: null,
    target_reps_min: null,
    target_reps_max: null,
    target_weight_kg: null,
    target_rir: null,
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  (db.routineExercises$ as any)[id].set(row);
  return id;
}

/**
 * Update the optional targets for a routine exercise.
 */
export function updateExerciseTargets(
  db: UserObservables,
  routineExerciseId: string,
  targets: {
    target_sets?: number | null;
    target_reps_min?: number | null;
    target_reps_max?: number | null;
    target_weight_kg?: number | null;
    target_rir?: number | null;
  },
): void {
  const now = new Date().toISOString();
  const obs = (db.routineExercises$ as any)[routineExerciseId];
  obs.set((prev: RoutineExerciseRow) => ({
    ...prev,
    ...targets,
    updated_at: now,
  }));
}

/**
 * After a drag-reorder, persist the new contiguous order_index values (0-based)
 * for all exercises in the routine.
 *
 * @param orderedIds - Exercise row ids in the new display order.
 */
export function reorderRoutineExercises(
  db: UserObservables,
  orderedIds: string[],
): void {
  const now = new Date().toISOString();
  orderedIds.forEach((id, index) => {
    const obs = (db.routineExercises$ as any)[id];
    obs.set((prev: RoutineExerciseRow) => ({
      ...prev,
      order_index: index,
      updated_at: now,
    }));
  });
}

/**
 * Remove an exercise from a routine (soft-delete the routine_exercise row).
 */
export function removeExerciseFromRoutine(db: UserObservables, routineExerciseId: string): void {
  softDelete(db.routineExercises$, routineExerciseId);
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export interface CreatePlanInput {
  name: string;
  userId: string;
}

/**
 * Create a new plan and set it as the active plan (deactivating others).
 * Returns the new plan id.
 */
export function createPlan(db: UserObservables, input: CreatePlanInput): string {
  const now = new Date().toISOString();
  const id = generateId();

  // Deactivate existing plans
  deactivateAllPlans(db, now);

  const row: PlanRow = {
    id,
    user_id: input.userId,
    name: input.name.trim(),
    is_active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  (db.plans$ as any)[id].set(row);
  return id;
}

/**
 * Set a specific plan as active; deactivate all others.
 */
export function setActivePlan(db: UserObservables, planId: string): void {
  const now = new Date().toISOString();
  deactivateAllPlans(db, now);
  const obs = (db.plans$ as any)[planId];
  obs.set((prev: PlanRow) => ({ ...prev, is_active: true, updated_at: now }));
}

function deactivateAllPlans(db: UserObservables, now: string): void {
  const snapshot = (db.plans$ as any).peek?.() ?? (db.plans$ as any).get?.();
  if (!snapshot) return;
  for (const id of Object.keys(snapshot)) {
    const plan = snapshot[id] as PlanRow;
    if (plan.is_active && !plan.deleted_at) {
      (db.plans$ as any)[id].set((prev: PlanRow) => ({
        ...prev,
        is_active: false,
        updated_at: now,
      }));
    }
  }
}

// ---------------------------------------------------------------------------
// Plan days
// ---------------------------------------------------------------------------

/**
 * Assign a routine to a specific weekday (0=Mon, 6=Sun) in a plan.
 * If there is already a plan_day for that weekday, it is replaced (soft-deleted + new created).
 * Returns the new plan_day id.
 */
export function assignRoutineToDay(
  db: UserObservables,
  planId: string,
  routineId: string,
  weekday: number,
  userId: string,
): string {
  const now = new Date().toISOString();

  // Soft-delete any existing plan_day for this weekday
  const snapshot = (db.planDays$ as any).peek?.() ?? (db.planDays$ as any).get?.();
  if (snapshot) {
    for (const id of Object.keys(snapshot)) {
      const pd = snapshot[id] as PlanDayRow;
      if (pd.plan_id === planId && pd.weekday === weekday && !pd.deleted_at) {
        softDelete(db.planDays$, id);
      }
    }
  }

  const id = generateId();
  const row: PlanDayRow = {
    id,
    user_id: userId,
    plan_id: planId,
    routine_id: routineId,
    order_index: weekday,
    weekday,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  (db.planDays$ as any)[id].set(row);
  return id;
}

/**
 * Remove the routine assignment for a specific weekday (soft-delete the plan_day).
 */
export function clearDayAssignment(
  db: UserObservables,
  planId: string,
  weekday: number,
): void {
  const snapshot = (db.planDays$ as any).peek?.() ?? (db.planDays$ as any).get?.();
  if (!snapshot) return;
  for (const id of Object.keys(snapshot)) {
    const pd = snapshot[id] as PlanDayRow;
    if (pd.plan_id === planId && pd.weekday === weekday && !pd.deleted_at) {
      softDelete(db.planDays$, id);
    }
  }
}

// ---------------------------------------------------------------------------
// Template cloning
// ---------------------------------------------------------------------------

export interface TemplateExercise {
  /** Exercise name matching the global catalog seed (case-sensitive) */
  exerciseName: string;
  orderIndex: number;
  target_sets?: number | null;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_weight_kg?: number | null;
  target_rir?: number | null;
}

export interface TemplateRoutine {
  name: string;
  weekday: number; // 0=Mon .. 6=Sun
  exercises: TemplateExercise[];
}

export interface Template {
  planName: string;
  routines: TemplateRoutine[];
  /**
   * TKT-0002: Stable identifier for this template (e.g. 'ppl', 'full-body-3').
   * Stored as `source_template_id` on every routine created by this call so
   * the runtime can distinguish template-cloned routines from manually created ones.
   * Must be unique per template and never change (it is persisted in the DB).
   */
  templateKey: string;
}

/**
 * Clone a template into the user's account:
 *   1. Soft-delete the previous active plan's template-cloned routines + plan_days
 *      (TKT-0002: PLAN-OWNED model). Manually-created routines are untouched.
 *   2. Deactivate all existing plans.
 *   3. Create one plan (active).
 *   4. For each template routine: create the routine + routine_exercises + plan_day.
 *      Each cloned routine gets `source_template_id = template.templateKey` so
 *      future template changes can identify and clean up these rows.
 *   5. Exercises are resolved by name from the globalExercises snapshot.
 *      Names not found in the catalog are skipped (logged to console).
 *
 * Returns the new plan id.
 */
export function createPlanFromTemplate(
  db: UserObservables,
  template: Template,
  globalExercises: Record<string, import('@/db').ExerciseRow>,
  userId: string,
): string {
  const now = new Date().toISOString();

  // Build name → exercise_id lookup
  const nameToId: Record<string, string> = {};
  for (const ex of Object.values(globalExercises)) {
    if (!ex.deleted_at) {
      nameToId[ex.name] = ex.id;
    }
  }

  // TKT-0002: Soft-delete orphan routines and plan_days from the previous
  // active plan BEFORE deactivating/replacing it. We snapshot routines,
  // planDays, and plans to keep the logic pure and testable.
  const routinesSnap = (db.routines$ as any).peek?.() ?? (db.routines$ as any).get?.() ?? {};
  const planDaysSnap = (db.planDays$ as any).peek?.() ?? (db.planDays$ as any).get?.() ?? {};
  const plansSnap = (db.plans$ as any).peek?.() ?? (db.plans$ as any).get?.() ?? {};

  // Find the current active plan id (there should be at most one)
  let oldPlanId: string | null = null;
  for (const [id, plan] of Object.entries(plansSnap as Record<string, PlanRow>)) {
    if ((plan as PlanRow).is_active && !(plan as PlanRow).deleted_at) {
      oldPlanId = id;
      break;
    }
  }

  if (oldPlanId) {
    const { planDayIds, routineIds } = selectOrphanIds(
      oldPlanId,
      routinesSnap,
      planDaysSnap,
      plansSnap,
    );
    for (const id of planDayIds) {
      softDelete(db.planDays$, id);
    }
    for (const id of routineIds) {
      softDelete(db.routines$, id);
    }
  }

  // Deactivate existing plans
  deactivateAllPlans(db, now);

  // Create plan
  const planId = generateId();
  const planRow: PlanRow = {
    id: planId,
    user_id: userId,
    name: template.planName,
    is_active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  (db.plans$ as any)[planId].set(planRow);

  // Create routines + routine_exercises + plan_days
  for (const templateRoutine of template.routines) {
    const routineId = generateId();
    const routineRow: RoutineRow = {
      id: routineId,
      user_id: userId,
      name: templateRoutine.name,
      notes: null,
      source_template_id: template.templateKey,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    (db.routines$ as any)[routineId].set(routineRow);

    // Routine exercises
    for (const te of templateRoutine.exercises) {
      const exerciseId = nameToId[te.exerciseName];
      if (!exerciseId) {
        console.warn(`[templates] Exercise not found in catalog: "${te.exerciseName}" — skipping`);
        continue;
      }

      const reId = generateId();
      const reRow: RoutineExerciseRow = {
        id: reId,
        user_id: userId,
        routine_id: routineId,
        exercise_id: exerciseId,
        order_index: te.orderIndex,
        target_sets: te.target_sets ?? null,
        target_reps_min: te.target_reps_min ?? null,
        target_reps_max: te.target_reps_max ?? null,
        target_weight_kg: te.target_weight_kg ?? null,
        target_rir: te.target_rir ?? null,
        notes: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      (db.routineExercises$ as any)[reId].set(reRow);
    }

    // Plan day (fixed weekday)
    const pdId = generateId();
    const pdRow: PlanDayRow = {
      id: pdId,
      user_id: userId,
      plan_id: planId,
      routine_id: routineId,
      order_index: templateRoutine.weekday,
      weekday: templateRoutine.weekday,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    (db.planDays$ as any)[pdId].set(pdRow);
  }

  return planId;
}
