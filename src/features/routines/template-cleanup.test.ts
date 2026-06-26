/**
 * TKT-0002 — Tests for selectOrphanIds (template-cleanup.ts).
 *
 * All tests are pure (no Legend-State / Supabase / React imports).
 */

import { selectOrphanIds } from './template-cleanup';
import type { RoutineRow, PlanDayRow, PlanRow } from '@/db';

// ---------------------------------------------------------------------------
// Helpers to build minimal fixtures
// ---------------------------------------------------------------------------

function makeRoutine(overrides: Partial<RoutineRow> & { id: string }): RoutineRow {
  return {
    user_id: 'user-1',
    name: 'Routine',
    notes: null,
    source_template_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

function makePlanDay(
  overrides: Partial<PlanDayRow> & { id: string; plan_id: string; routine_id: string },
): PlanDayRow {
  return {
    user_id: 'user-1',
    order_index: 0,
    weekday: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

function makePlan(overrides: Partial<PlanRow> & { id: string }): PlanRow {
  return {
    user_id: 'user-1',
    name: 'Plan',
    is_active: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixtures: one old plan with two routines (one cloned, one manual)
// ---------------------------------------------------------------------------

const OLD_PLAN_ID = 'plan-old';
const NEW_PLAN_ID = 'plan-new';

const clonedRoutine = makeRoutine({ id: 'r-cloned', source_template_id: 'tpl-ppl' });
const manualRoutine = makeRoutine({ id: 'r-manual', source_template_id: null });

const pdForCloned = makePlanDay({ id: 'pd-1', plan_id: OLD_PLAN_ID, routine_id: 'r-cloned' });
const pdForManual = makePlanDay({ id: 'pd-2', plan_id: OLD_PLAN_ID, routine_id: 'r-manual' });

const oldPlan = makePlan({ id: OLD_PLAN_ID, is_active: false }); // already deactivated when cleanup runs
const newPlan = makePlan({ id: NEW_PLAN_ID, is_active: true });

const baseRoutines: Record<string, RoutineRow> = {
  [clonedRoutine.id]: clonedRoutine,
  [manualRoutine.id]: manualRoutine,
};
const basePlanDays: Record<string, PlanDayRow> = {
  [pdForCloned.id]: pdForCloned,
  [pdForManual.id]: pdForManual,
};
const basePlans: Record<string, PlanRow> = {
  [oldPlan.id]: oldPlan,
  [newPlan.id]: newPlan,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectOrphanIds (TKT-0002)', () => {
  it('soft-deletes cloned routines and all plan_days of the old plan', () => {
    const result = selectOrphanIds(OLD_PLAN_ID, baseRoutines, basePlanDays, basePlans);

    expect(result.planDayIds).toHaveLength(2);
    expect(result.planDayIds).toContain('pd-1');
    expect(result.planDayIds).toContain('pd-2');

    expect(result.routineIds).toHaveLength(1);
    expect(result.routineIds).toContain('r-cloned');
  });

  it('never deletes a manually-created routine (source_template_id is null)', () => {
    const result = selectOrphanIds(OLD_PLAN_ID, baseRoutines, basePlanDays, basePlans);

    expect(result.routineIds).not.toContain('r-manual');
  });

  it('keeps a cloned routine that is referenced by another active plan', () => {
    // New plan also references the cloned routine
    const sharedPd = makePlanDay({
      id: 'pd-shared',
      plan_id: NEW_PLAN_ID,
      routine_id: 'r-cloned',
    });
    const planDays = { ...basePlanDays, [sharedPd.id]: sharedPd };

    const result = selectOrphanIds(OLD_PLAN_ID, baseRoutines, planDays, basePlans);

    // plan_days of old plan are still deleted (they belong to the old plan)
    expect(result.planDayIds).toContain('pd-1');
    expect(result.planDayIds).toContain('pd-2');

    // r-cloned is shared → must NOT be soft-deleted
    expect(result.routineIds).not.toContain('r-cloned');
    expect(result.routineIds).toHaveLength(0);
  });

  it('does not include already-soft-deleted plan_days', () => {
    const alreadyDeleted = makePlanDay({
      id: 'pd-already-gone',
      plan_id: OLD_PLAN_ID,
      routine_id: 'r-cloned',
      deleted_at: '2026-01-01T00:00:00Z',
    });
    const planDays = { ...basePlanDays, [alreadyDeleted.id]: alreadyDeleted };

    const result = selectOrphanIds(OLD_PLAN_ID, baseRoutines, planDays, basePlans);

    expect(result.planDayIds).not.toContain('pd-already-gone');
  });

  it('does not delete a cloned routine that is already soft-deleted', () => {
    const alreadyDeletedRoutine = makeRoutine({
      id: 'r-cloned-gone',
      source_template_id: 'tpl-ppl',
      deleted_at: '2026-01-01T00:00:00Z',
    });
    const pd = makePlanDay({ id: 'pd-for-gone', plan_id: OLD_PLAN_ID, routine_id: 'r-cloned-gone' });
    const routines = { ...baseRoutines, [alreadyDeletedRoutine.id]: alreadyDeletedRoutine };
    const planDays = { ...basePlanDays, [pd.id]: pd };

    const result = selectOrphanIds(OLD_PLAN_ID, routines, planDays, basePlans);

    expect(result.routineIds).not.toContain('r-cloned-gone');
  });

  it('returns empty arrays when the old plan had no plan_days', () => {
    const result = selectOrphanIds(OLD_PLAN_ID, baseRoutines, {}, basePlans);

    expect(result.planDayIds).toHaveLength(0);
    expect(result.routineIds).toHaveLength(0);
  });
});
