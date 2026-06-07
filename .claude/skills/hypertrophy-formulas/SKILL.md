---
name: hypertrophy-formulas
description: RepLog's calculation rules — estimated 1RM, fractional per-muscle volume, sets per muscle group, PR detection, and tonnage. Use it whenever you compute metrics or detect records.
---

# RepLog calculations (hypertrophy)

Exact rules so all calculations are consistent. **Warm-ups (`is_warmup = true`) are excluded from EVERYTHING** (volume, sets, PRs, tonnage). Only working sets with `reps >= 1` count.

## Estimated 1RM
Default formula **Epley**:
```
1RM ≈ weight_kg * (1 + reps / 30)
```
Brzycki alternative (if it becomes configurable later): `weight_kg * 36 / (37 - reps)`.
- Uses `weight_kg` (canonical). For `reps = 1`, 1RM = `weight_kg`.
- An exercise's "best estimated 1RM" = max over its historical working sets.

## Fractional per-muscle volume
Each working set contributes its `contribution` (from `exercise_muscles`) to each muscle: primary 1.0, secondary 0.5.
```
weekly_volume[muscle] = Σ contribution  (over the week's working sets whose exercise targets that muscle)
```

## "Sets per muscle group" (summary and history)
Sum of `contribution` per muscle, **rounded to 0.5** for display. E.g.: a bench-press set = chest +1.0, shoulders +0.5, arms +0.5.
- "Total effective sets" of a session = number of working sets (integer count, unweighted).

## PR detection (in the moment)
On saving a working set of an exercise, it's a PR if it meets **either**:
- **Estimated-1RM PR**: its estimated 1RM > the exercise's previous best estimated 1RM.
- **Rep-PR**: more `reps` than the previous max recorded at a `weight_kg` **equal or greater**.

## Tonnage (optional)
```
tonnage = Σ (weight_kg * reps)   (working sets)
```

## Unit conversion
- Store the typed value (`weight_value` + `weight_unit`) and the canonical `weight_kg`.
- `kg → lb`: `* 2.2046226`; `lb → kg`: `/ 2.2046226`.
- ALWAYS display `weight_value`/`weight_unit` (no rounding); ALWAYS compute with `weight_kg`.

## Suggested TypeScript signatures
```ts
estimate1RM(weightKg: number, reps: number): number
weeklyVolumeByMuscle(sets: SetRow[]): Record<Muscle, number>
sessionSetsByMuscle(sets: SetRow[]): Record<Muscle, number>
isPR(set: SetRow, history: SetRow[]): { oneRm: boolean; rep: boolean }
toKg(value: number, unit: 'kg' | 'lb'): number
```
All ignore `is_warmup`. Cover with unit tests (see Build Plan phase 5).
