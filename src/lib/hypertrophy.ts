/**
 * Hypertrophy calculation utilities.
 *
 * Pure functions — zero React Native or Legend-State imports.
 * All formulas match docs/.claude/skills/hypertrophy-formulas/SKILL.md exactly.
 *
 * Key rule: warm-up sets (is_warmup === true) are EXCLUDED from every
 * calculation here. Callers must not pre-filter; each function enforces it.
 */

import type { MuscleEnum, SetRow, ExerciseMuscleRow } from '@/db';

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

/** Exact factor from hypertrophy-formulas SKILL.md: kg → lb */
const KG_TO_LB_FACTOR = 2.2046226;

/**
 * Convert kilograms to pounds.
 * Skill ref: "kg → lb: * 2.2046226"
 */
export function kgToLb(kg: number): number {
  return kg * KG_TO_LB_FACTOR;
}

/**
 * Convert pounds to kilograms.
 * Skill ref: "lb → kg: / 2.2046226"
 */
export function lbToKg(lb: number): number {
  return lb / KG_TO_LB_FACTOR;
}

/**
 * Convert a typed weight value to canonical kilograms for storage and computation.
 * Skill ref: "Store the typed value (weight_value + weight_unit) and the canonical weight_kg."
 */
export function toCanonicalKg(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? lbToKg(value) : value;
}

// ---------------------------------------------------------------------------
// Estimated 1RM
// ---------------------------------------------------------------------------

/**
 * Calculate the estimated one-rep max from a set.
 *
 * Epley (default):   weightKg * (1 + reps / 30)
 * Brzycki:           weightKg * 36 / (37 - reps)
 *
 * Special cases:
 *   reps <= 0  → returns 0 (guard against invalid input)
 *   reps === 1 → returns weightKg (definition: one rep IS the 1RM)
 *
 * Skill ref: "Estimated 1RM — Default formula Epley: 1RM ≈ weight_kg * (1 + reps / 30)"
 * Skill ref: "Brzycki alternative: weight_kg * 36 / (37 - reps)"
 * Skill ref: "For reps = 1, 1RM = weight_kg"
 */
export function estimated1RM(
  weightKg: number,
  reps: number,
  formula: 'epley' | 'brzycki' = 'epley',
): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;

  if (formula === 'brzycki') {
    const denominator = 37 - reps;
    // Guard: Brzycki breaks down at reps >= 37 (denominator <= 0)
    if (denominator <= 0) return weightKg;
    return (weightKg * 36) / denominator;
  }

  // Epley (default)
  return weightKg * (1 + reps / 30);
}

// ---------------------------------------------------------------------------
// Volume helpers
// ---------------------------------------------------------------------------

/**
 * A condensed view of exercise_muscles rows keyed by session_exercise_id.
 * Callers build this from the observable snapshots so this file stays
 * framework-agnostic.
 */
export type MusclesBySessionExerciseId = Record<
  string,
  Pick<ExerciseMuscleRow, 'muscle' | 'contribution'>[]
>;

/**
 * Sum the fractional contribution per muscle group over all WORKING sets
 * (is_warmup === false, reps >= 1).
 *
 * Each working set contributes its exercise_muscles.contribution to each
 * muscle the exercise targets: 1.0 for primary, 0.5 for secondary by default.
 *
 * Muscles not represented in musclesByExerciseId are simply skipped.
 *
 * Returns a partial Record so callers can choose a default for missing muscles.
 *
 * Skill ref:
 *   "weekly_volume[muscle] = Σ contribution  (over the week's working sets
 *    whose exercise targets that muscle)"
 */
export function fractionalVolumeByMuscle(
  sets: SetRow[],
  musclesByExerciseId: MusclesBySessionExerciseId,
): Partial<Record<MuscleEnum, number>> {
  const volume: Partial<Record<MuscleEnum, number>> = {};

  for (const set of sets) {
    // Warm-ups never count — skill rule: "is_warmup = true rows excluded from EVERYTHING"
    if (set.is_warmup) continue;
    // Only sets with actual reps
    if (!set.reps || set.reps < 1) continue;
    // Soft-deleted rows should not be present but guard anyway
    if (set.deleted_at) continue;

    // Resolve the exercise for this set via session_exercise → we receive the
    // session_exercise_id keyed map, so the caller must build it from session_exercises.
    // This function accepts a pre-keyed map for testability.
    const muscles = musclesByExerciseId[set.session_exercise_id];
    if (!muscles) continue;

    for (const m of muscles) {
      volume[m.muscle] = (volume[m.muscle] ?? 0) + m.contribution;
    }
  }

  return volume;
}

/**
 * Count the number of working (non-warmup, non-deleted) sets.
 *
 * Skill ref: "Total effective sets of a session = number of working sets (integer count, unweighted)"
 */
export function effectiveSetCount(sets: SetRow[]): number {
  return sets.filter((s) => !s.is_warmup && !s.deleted_at && s.reps != null && s.reps >= 1).length;
}

/**
 * Sum of (weight_kg × reps) over all working (non-warmup, non-deleted) sets.
 *
 * Skill ref: "tonnage = Σ (weight_kg * reps)   (working sets)"
 */
export function tonnage(sets: SetRow[]): number {
  let total = 0;
  for (const set of sets) {
    if (set.is_warmup) continue;
    if (set.deleted_at) continue;
    if (!set.reps || set.reps < 1) continue;
    if (set.weight_kg == null) continue;
    total += set.weight_kg * set.reps;
  }
  return total;
}
