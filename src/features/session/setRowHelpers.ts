/**
 * Pure helper functions for set-row logic.
 *
 * These have NO React Native / Legend-State imports so they can be
 * unit-tested in the jest node environment.
 */

import type { FailureMetricEnum } from '@/db';

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
