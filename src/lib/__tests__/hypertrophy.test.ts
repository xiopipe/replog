/**
 * Unit tests for src/lib/hypertrophy.ts
 *
 * Domain rules source of truth:
 *   - docs/.claude/skills/hypertrophy-formulas/SKILL.md
 *   - docs/specs/Tracking.md
 *   - Architecture.md
 *
 * Warm-ups (is_warmup === true) are EXCLUDED from every calculation.
 * Only working sets with reps >= 1 count.
 */

import {
  estimated1RM,
  kgToLb,
  lbToKg,
  toCanonicalKg,
  fractionalVolumeByMuscle,
  effectiveSetCount,
  tonnage,
  type MusclesBySessionExerciseId,
} from '@/lib/hypertrophy';
import type { SetRow } from '@/db';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Minimal valid working SetRow. Callers override what they need. */
function makeSet(overrides: Partial<SetRow>): SetRow {
  return {
    id: 'set-1',
    user_id: 'user-1',
    session_exercise_id: 'se-1',
    set_index: 0,
    weight_value: 100,
    weight_unit: 'kg',
    weight_kg: 100,
    reps: 10,
    failure_metric: 'rir',
    rir: 2,
    rpe: null,
    is_warmup: false,
    reached_failure: false,
    rest_seconds: null,
    drop_group: null,
    drop_order: null,
    performed_at: '2026-01-01T10:00:00.000Z',
    metadata: {},
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// estimated1RM
// ---------------------------------------------------------------------------

describe('estimated1RM', () => {
  describe('Epley (default)', () => {
    it('100 kg × 10 reps → 133.33...', () => {
      // Epley: 100 * (1 + 10/30) = 100 * 1.3333... = 133.333...
      expect(estimated1RM(100, 10)).toBeCloseTo(133.333, 2);
    });

    it('80 kg × 5 reps → 93.33...', () => {
      // 80 * (1 + 5/30) = 80 * 1.1666... = 93.333...
      expect(estimated1RM(80, 5)).toBeCloseTo(93.333, 2);
    });

    it('reps === 1 → returns weightKg (1RM is the lift itself)', () => {
      expect(estimated1RM(100, 1)).toBe(100);
      expect(estimated1RM(75, 1)).toBe(75);
    });

    it('reps <= 0 → returns 0 (invalid guard)', () => {
      expect(estimated1RM(100, 0)).toBe(0);
      expect(estimated1RM(100, -5)).toBe(0);
    });
  });

  describe('Brzycki', () => {
    it('100 kg × 10 reps → weightKg * 36 / (37 - 10) = 3600/27 = 133.33...', () => {
      // Brzycki: 100 * 36 / (37 - 10) = 100 * 36 / 27 = 133.333...
      expect(estimated1RM(100, 10, 'brzycki')).toBeCloseTo(133.333, 2);
    });

    it('60 kg × 6 reps', () => {
      // 60 * 36 / (37 - 6) = 60 * 36 / 31 = 69.677...
      expect(estimated1RM(60, 6, 'brzycki')).toBeCloseTo(69.677, 2);
    });

    it('reps === 1 → returns weightKg', () => {
      expect(estimated1RM(100, 1, 'brzycki')).toBe(100);
    });

    it('reps >= 37 → returns weightKg (denominator guard, prevents infinity/negative)', () => {
      expect(estimated1RM(100, 37, 'brzycki')).toBe(100);
      expect(estimated1RM(100, 50, 'brzycki')).toBe(100);
    });

    it('reps <= 0 → returns 0 (guard before formula)', () => {
      expect(estimated1RM(100, 0, 'brzycki')).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

describe('kgToLb', () => {
  const FACTOR = 2.2046226;

  it('1 kg → 2.2046226 lb (exact factor)', () => {
    expect(kgToLb(1)).toBeCloseTo(FACTOR, 6);
  });

  it('100 kg → 220.46226 lb', () => {
    expect(kgToLb(100)).toBeCloseTo(100 * FACTOR, 4);
  });

  it('0 kg → 0 lb', () => {
    expect(kgToLb(0)).toBe(0);
  });
});

describe('lbToKg', () => {
  const FACTOR = 2.2046226;

  it('2.2046226 lb → 1 kg (exact reverse)', () => {
    expect(lbToKg(FACTOR)).toBeCloseTo(1, 6);
  });

  it('220.46226 lb → 100 kg', () => {
    expect(lbToKg(220.46226)).toBeCloseTo(100, 4);
  });

  it('0 lb → 0 kg', () => {
    expect(lbToKg(0)).toBe(0);
  });
});

describe('kgToLb / lbToKg round-trip', () => {
  it('round-trip: 75.5 kg → lb → kg preserves value within floating point', () => {
    expect(lbToKg(kgToLb(75.5))).toBeCloseTo(75.5, 6);
  });

  it('round-trip: 185 lb → kg → lb preserves value within floating point', () => {
    expect(kgToLb(lbToKg(185))).toBeCloseTo(185, 6);
  });
});

describe('toCanonicalKg', () => {
  it('kg passthrough — returns value unchanged', () => {
    expect(toCanonicalKg(100, 'kg')).toBe(100);
    expect(toCanonicalKg(0, 'kg')).toBe(0);
  });

  it('lb → converts using the exact factor', () => {
    expect(toCanonicalKg(2.2046226, 'lb')).toBeCloseTo(1, 6);
    expect(toCanonicalKg(220.46226, 'lb')).toBeCloseTo(100, 4);
  });
});

// ---------------------------------------------------------------------------
// fractionalVolumeByMuscle
// ---------------------------------------------------------------------------

describe('fractionalVolumeByMuscle', () => {
  /** A muscles map: se-1 → bench press (chest primary, shoulders secondary, arms secondary) */
  const muscles: MusclesBySessionExerciseId = {
    'se-1': [
      { muscle: 'chest', contribution: 1.0 },
      { muscle: 'shoulders', contribution: 0.5 },
      { muscle: 'arms', contribution: 0.5 },
    ],
    'se-2': [
      { muscle: 'back', contribution: 1.0 },
      { muscle: 'arms', contribution: 0.5 },
    ],
  };

  it('empty sets → empty record', () => {
    expect(fractionalVolumeByMuscle([], muscles)).toEqual({});
  });

  it('single working set → primary 1.0, secondary 0.5', () => {
    const sets = [makeSet({ session_exercise_id: 'se-1' })];
    const result = fractionalVolumeByMuscle(sets, muscles);
    expect(result.chest).toBeCloseTo(1.0);
    expect(result.shoulders).toBeCloseTo(0.5);
    expect(result.arms).toBeCloseTo(0.5);
    // Muscles not in se-1 should be absent
    expect(result.back).toBeUndefined();
  });

  it('warm-up sets are EXCLUDED (primary rule)', () => {
    const sets = [
      makeSet({ is_warmup: true, session_exercise_id: 'se-1' }),
      makeSet({ is_warmup: true, session_exercise_id: 'se-2' }),
    ];
    expect(fractionalVolumeByMuscle(sets, muscles)).toEqual({});
  });

  it('mix of warmup and working — only working sets counted', () => {
    const sets = [
      makeSet({ id: 's1', is_warmup: true, session_exercise_id: 'se-1' }),
      makeSet({ id: 's2', is_warmup: false, session_exercise_id: 'se-1' }),
    ];
    const result = fractionalVolumeByMuscle(sets, muscles);
    // Only one working set → chest should be 1.0, not 2.0
    expect(result.chest).toBeCloseTo(1.0);
  });

  it('multiple working sets accumulate contributions', () => {
    const sets = [
      makeSet({ id: 's1', session_exercise_id: 'se-1' }),
      makeSet({ id: 's2', session_exercise_id: 'se-1' }),
      makeSet({ id: 's3', session_exercise_id: 'se-1' }),
    ];
    const result = fractionalVolumeByMuscle(sets, muscles);
    // 3 sets × 1.0 chest = 3.0; 3 × 0.5 shoulders = 1.5; 3 × 0.5 arms = 1.5
    expect(result.chest).toBeCloseTo(3.0);
    expect(result.shoulders).toBeCloseTo(1.5);
    expect(result.arms).toBeCloseTo(1.5);
  });

  it('multiple exercises accumulate to shared muscles (arms from both exercises)', () => {
    const sets = [
      makeSet({ id: 's1', session_exercise_id: 'se-1' }), // arms +0.5
      makeSet({ id: 's2', session_exercise_id: 'se-2' }), // arms +0.5
    ];
    const result = fractionalVolumeByMuscle(sets, muscles);
    // arms: 0.5 (from se-1) + 0.5 (from se-2) = 1.0
    expect(result.arms).toBeCloseTo(1.0);
    expect(result.chest).toBeCloseTo(1.0);
    expect(result.back).toBeCloseTo(1.0);
  });

  it('soft-deleted sets are excluded', () => {
    const sets = [
      makeSet({ id: 's1', deleted_at: '2026-01-01T11:00:00.000Z', session_exercise_id: 'se-1' }),
    ];
    expect(fractionalVolumeByMuscle(sets, muscles)).toEqual({});
  });

  it('sets with reps < 1 are excluded', () => {
    const sets = [makeSet({ reps: 0, session_exercise_id: 'se-1' })];
    expect(fractionalVolumeByMuscle(sets, muscles)).toEqual({});
  });

  it('sets whose session_exercise_id is not in the map are silently skipped', () => {
    const sets = [makeSet({ session_exercise_id: 'se-unknown' })];
    expect(fractionalVolumeByMuscle(sets, muscles)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// effectiveSetCount
// ---------------------------------------------------------------------------

describe('effectiveSetCount', () => {
  it('empty array → 0', () => {
    expect(effectiveSetCount([])).toBe(0);
  });

  it('counts only non-warmup sets', () => {
    const sets = [
      makeSet({ id: 's1', is_warmup: true }),
      makeSet({ id: 's2', is_warmup: false }),
      makeSet({ id: 's3', is_warmup: false }),
    ];
    expect(effectiveSetCount(sets)).toBe(2);
  });

  it('all warmups → 0', () => {
    const sets = [
      makeSet({ id: 's1', is_warmup: true }),
      makeSet({ id: 's2', is_warmup: true }),
    ];
    expect(effectiveSetCount(sets)).toBe(0);
  });

  it('soft-deleted sets are not counted', () => {
    const sets = [
      makeSet({ id: 's1', deleted_at: '2026-01-01T11:00:00.000Z' }),
      makeSet({ id: 's2' }),
    ];
    expect(effectiveSetCount(sets)).toBe(1);
  });

  it('sets with reps < 1 are not counted', () => {
    const sets = [
      makeSet({ id: 's1', reps: 0 }),
      makeSet({ id: 's2', reps: 5 }),
    ];
    expect(effectiveSetCount(sets)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// tonnage
// ---------------------------------------------------------------------------

describe('tonnage', () => {
  it('empty array → 0', () => {
    expect(tonnage([])).toBe(0);
  });

  it('single working set: 100 kg × 10 reps = 1000', () => {
    expect(tonnage([makeSet({ weight_kg: 100, reps: 10 })])).toBe(1000);
  });

  it('sums across multiple sets', () => {
    const sets = [
      makeSet({ id: 's1', weight_kg: 100, reps: 10 }), // 1000
      makeSet({ id: 's2', weight_kg: 80, reps: 8 }),   // 640
      makeSet({ id: 's3', weight_kg: 60, reps: 12 }),  // 720
    ];
    expect(tonnage(sets)).toBeCloseTo(2360);
  });

  it('warm-up sets are excluded from tonnage', () => {
    const sets = [
      makeSet({ id: 's1', is_warmup: true, weight_kg: 60, reps: 10 }),  // excluded
      makeSet({ id: 's2', is_warmup: false, weight_kg: 100, reps: 10 }), // 1000
    ];
    expect(tonnage(sets)).toBe(1000);
  });

  it('soft-deleted sets excluded', () => {
    const sets = [
      makeSet({ id: 's1', deleted_at: '2026-01-01T11:00:00.000Z', weight_kg: 100, reps: 10 }),
      makeSet({ id: 's2', weight_kg: 80, reps: 5 }), // 400
    ];
    expect(tonnage(sets)).toBe(400);
  });

  it('sets with null weight_kg are excluded (contributes 0)', () => {
    const sets = [
      makeSet({ id: 's1', weight_kg: null, reps: 10 }),
      makeSet({ id: 's2', weight_kg: 100, reps: 5 }), // 500
    ];
    expect(tonnage(sets)).toBe(500);
  });
});
