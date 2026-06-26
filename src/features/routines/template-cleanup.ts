/**
 * TKT-0002 — Template-change cleanup helpers.
 *
 * Pure, node-testable functions that decide WHICH routine ids and plan_day ids
 * should be soft-deleted when the user switches the active starter template.
 *
 * Decision rules (PLAN-OWNED model):
 *   - A routine is eligible for auto-soft-delete ONLY when:
 *       a) it has a non-null source_template_id (was cloned from a template), AND
 *       b) it is not referenced by any other active (non-deleted) plan.
 *   - Routines without source_template_id (manual or pre-migration) are NEVER deleted.
 *   - All plan_days belonging to the old plan are always soft-deleted (they only
 *     point into that plan's schedule, so they are plan-owned unconditionally).
 *
 * These helpers have zero Legend-State / React / Supabase imports so they can
 * be exercised in a plain Jest environment.
 */

import type { RoutineRow, PlanDayRow, PlanRow } from '@/db';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OrphanIds {
  /** plan_day ids to soft-delete (all days of oldPlanId that are not deleted). */
  planDayIds: string[];
  /** routine ids to soft-delete (cloned + not used by any other active plan). */
  routineIds: string[];
}

/**
 * Given a snapshot of the local observables, compute which ids should be
 * soft-deleted when the user switches away from `oldPlanId` to a new template.
 *
 * @param oldPlanId   - The plan that is being deactivated / replaced.
 * @param routines    - Full snapshot of routines$ (including soft-deleted rows;
 *                      filter `deleted_at` yourself if needed — this fn is pure).
 * @param planDays    - Full snapshot of planDays$.
 * @param plans       - Full snapshot of plans$ (used to detect other active plans).
 * @returns           - `{ planDayIds, routineIds }` — both arrays may be empty.
 */
export function selectOrphanIds(
  oldPlanId: string,
  routines: Record<string, RoutineRow>,
  planDays: Record<string, PlanDayRow>,
  plans: Record<string, PlanRow>,
): OrphanIds {
  // ---- 1. Collect plan_day ids belonging to the old plan (non-deleted) ----
  const planDayIds: string[] = [];
  // Collect routine ids referenced by the OLD plan's plan_days
  const oldPlanRoutineIds = new Set<string>();

  for (const pd of Object.values(planDays)) {
    if (pd.plan_id === oldPlanId && !pd.deleted_at) {
      planDayIds.push(pd.id);
      oldPlanRoutineIds.add(pd.routine_id);
    }
  }

  // ---- 2. Find routine ids that are referenced by OTHER active plans ------
  // "Other active plan" = not the old plan, not deleted, not soft-deleted.
  const otherActivePlanIds = new Set<string>();
  for (const plan of Object.values(plans)) {
    if (plan.id !== oldPlanId && plan.is_active && !plan.deleted_at) {
      otherActivePlanIds.add(plan.id);
    }
  }

  const routinesUsedElsewhere = new Set<string>();
  for (const pd of Object.values(planDays)) {
    if (otherActivePlanIds.has(pd.plan_id) && !pd.deleted_at) {
      routinesUsedElsewhere.add(pd.routine_id);
    }
  }

  // ---- 3. Select cloned routines that are NOT used elsewhere --------------
  const routineIds: string[] = [];
  for (const routineId of oldPlanRoutineIds) {
    const routine = routines[routineId];
    if (!routine) continue; // already gone
    if (routine.deleted_at) continue; // already soft-deleted
    if (!routine.source_template_id) continue; // manual — never auto-delete
    if (routinesUsedElsewhere.has(routineId)) continue; // shared — keep it
    routineIds.push(routineId);
  }

  return { planDayIds, routineIds };
}
