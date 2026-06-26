/**
 * Pure helper functions for set-row logic.
 *
 * These have NO React Native / Legend-State imports so they can be
 * unit-tested in the jest node environment.
 */

import type { FailureMetricEnum, UnitEnum } from '@/db';

// ---------------------------------------------------------------------------
// TKT-0061 — RIR/RPE unset-placeholder stepper logic
// ---------------------------------------------------------------------------

/**
 * The minimum valid value for each metric:
 *   RIR  → 0  (0 = reached failure)
 *   RPE  → 1  (scale 1–10; 0 is not a valid RPE)
 *   none → irrelevant
 */
export function metricMin(metric: FailureMetricEnum): number {
  return metric === 'rpe' ? 1 : 0;
}

/**
 * The maximum valid value for each metric.
 */
export function metricMax(metric: FailureMetricEnum): number {
  return metric === 'rpe' ? 10 : 5;
}

/**
 * Increment a nullable RIR/RPE value.
 *
 * null → min value for the metric (first tap sets to min)
 * n    → min(n + 1, max)
 */
export function incrementFailureVal(
  current: number | null,
  metric: FailureMetricEnum,
): number {
  const min = metricMin(metric);
  const max = metricMax(metric);
  if (current === null) return min;
  return Math.min(max, current + 1);
}

/**
 * Decrement a nullable RIR/RPE value.
 *
 * null → no-op (return null)
 * n    → max(min, n - 1)
 */
export function decrementFailureVal(
  current: number | null,
  metric: FailureMetricEnum,
): number | null {
  if (current === null) return null;
  return Math.max(metricMin(metric), current - 1);
}

// ---------------------------------------------------------------------------
// TKT-0017 — Routine target: compute met status
// ---------------------------------------------------------------------------

/**
 * Count working (non-warmup, non-deleted) confirmed sets for an exercise.
 * Used to check whether the user has reached the target set count.
 */
export function countWorkingSets(
  sets: { is_warmup: boolean; deleted_at: string | null }[],
): number {
  return sets.filter((s) => !s.is_warmup && !s.deleted_at).length;
}

/**
 * Returns true when the user has logged at least targetSets working sets.
 * If targetSets is null/0 → never "met" (no target defined).
 */
export function isTargetMet(workingSetCount: number, targetSets: number | null): boolean {
  if (!targetSets) return false;
  return workingSetCount >= targetSets;
}

// ---------------------------------------------------------------------------
// TKT-0026 — Duplicate set with increments
// ---------------------------------------------------------------------------

export interface DuplicateVariant {
  label: string; // i18n key suffix — caller wraps with t()
  weightDelta: number; // kg delta (0 for same/+1rep, default 2.5 for +weight)
  repsDelta: number;  // reps delta
}

// ---------------------------------------------------------------------------
// TKT-0016 — Configurable weight increment
// ---------------------------------------------------------------------------

/** Valid increment choices for kg. */
export const WEIGHT_INCREMENT_OPTIONS_KG = [1.25, 2.5, 5] as const;
/** Valid increment choices for lb. */
export const WEIGHT_INCREMENT_OPTIONS_LB = [2.5, 5, 10] as const;

/**
 * Return the ordered list of valid increment choices for the given unit.
 */
export function getIncrementOptions(unit: UnitEnum): readonly number[] {
  return unit === 'lb' ? WEIGHT_INCREMENT_OPTIONS_LB : WEIGHT_INCREMENT_OPTIONS_KG;
}

/**
 * Default increment per unit (matches historical hard-coded value of 2.5).
 */
export function defaultIncrement(unit: UnitEnum): number {
  // Both kg and lb default to 2.5 (matches the historical hard-coded stepper value).
  return 2.5;
}

/**
 * Resolve the effective increment to use in the stepper.
 *
 * If `stored` is null/undefined or is not one of the valid options for `unit`,
 * fall back to `defaultIncrement(unit)`.
 */
export function resolveIncrement(stored: number | null | undefined, unit: UnitEnum): number {
  const options = getIncrementOptions(unit);
  if (stored != null && (options as readonly number[]).includes(stored)) {
    return stored;
  }
  return defaultIncrement(unit);
}

/**
 * Apply +increment to `current`, flooring at 0.
 *
 * Rounds to 4 significant decimal places to avoid float drift (e.g. 1.25 + 1.25 = 2.5, not 2.4999999).
 */
export function applyIncrement(current: number, increment: number): number {
  return Math.round((current + increment) * 10000) / 10000;
}

/**
 * Apply −increment to `current`, flooring at 0 (bodyweight sets can be 0).
 */
export function applyDecrement(current: number, increment: number): number {
  return Math.max(0, Math.round((current - increment) * 10000) / 10000);
}

/**
 * Returns the three long-press duplicate variants.
 * Caller maps label through t('session.' + variant.label).
 */
export function getDuplicateVariants(weightIncrement = 2.5): DuplicateVariant[] {
  return [
    { label: 'duplicate_same', weightDelta: 0, repsDelta: 0 },
    { label: 'duplicate_plus_rep', weightDelta: 0, repsDelta: 1 },
    { label: 'duplicate_plus_weight', weightDelta: weightIncrement, repsDelta: 0 },
  ];
}
