/**
 * Unit tests for src/features/session/setRowHelpers.ts
 *
 * Pure functions only — no React Native imports.
 */

import {
  incrementFailureVal,
  decrementFailureVal,
  metricMin,
  metricMax,
  countWorkingSets,
  isTargetMet,
  getDuplicateVariants,
} from '@/features/session/setRowHelpers';

// ---------------------------------------------------------------------------
// TKT-0061 — RIR/RPE unset-placeholder stepper logic
// ---------------------------------------------------------------------------

describe('metricMin', () => {
  it('returns 0 for rir', () => expect(metricMin('rir')).toBe(0));
  it('returns 1 for rpe', () => expect(metricMin('rpe')).toBe(1));
  it('returns 0 for none', () => expect(metricMin('none')).toBe(0));
});

describe('metricMax', () => {
  it('returns 5 for rir', () => expect(metricMax('rir')).toBe(5));
  it('returns 10 for rpe', () => expect(metricMax('rpe')).toBe(10));
});

describe('incrementFailureVal', () => {
  describe('from null (unset)', () => {
    it('RIR: null + increment → 0 (minimum for RIR)', () => {
      expect(incrementFailureVal(null, 'rir')).toBe(0);
    });
    it('RPE: null + increment → 1 (minimum for RPE)', () => {
      expect(incrementFailureVal(null, 'rpe')).toBe(1);
    });
  });

  describe('from a numeric value', () => {
    it('increments by 1', () => {
      expect(incrementFailureVal(2, 'rir')).toBe(3);
    });
    it('clamps to max for rir (5)', () => {
      expect(incrementFailureVal(5, 'rir')).toBe(5);
    });
    it('clamps to max for rpe (10)', () => {
      expect(incrementFailureVal(10, 'rpe')).toBe(10);
    });
    it('RIR 0 increments to 1', () => {
      expect(incrementFailureVal(0, 'rir')).toBe(1);
    });
  });
});

describe('decrementFailureVal', () => {
  describe('from null (unset)', () => {
    it('RIR: null − decrement → null (no-op)', () => {
      expect(decrementFailureVal(null, 'rir')).toBeNull();
    });
    it('RPE: null − decrement → null (no-op)', () => {
      expect(decrementFailureVal(null, 'rpe')).toBeNull();
    });
  });

  describe('from a numeric value', () => {
    it('decrements by 1', () => {
      expect(decrementFailureVal(3, 'rir')).toBe(2);
    });
    it('clamps to 0 for rir (floor = 0)', () => {
      expect(decrementFailureVal(0, 'rir')).toBe(0);
    });
    it('clamps to 1 for rpe (floor = 1)', () => {
      expect(decrementFailureVal(1, 'rpe')).toBe(1);
    });
    it('RIR 1 decrements to 0', () => {
      expect(decrementFailureVal(1, 'rir')).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// TKT-0017 — Routine target: isTargetMet
// ---------------------------------------------------------------------------

describe('countWorkingSets', () => {
  it('counts non-warmup, non-deleted sets', () => {
    const sets = [
      { is_warmup: false, deleted_at: null },
      { is_warmup: true, deleted_at: null },  // warmup — not counted
      { is_warmup: false, deleted_at: '2026-01-01T00:00:00Z' }, // deleted — not counted
    ];
    expect(countWorkingSets(sets)).toBe(1);
  });

  it('returns 0 when all sets are warmups', () => {
    const sets = [
      { is_warmup: true, deleted_at: null },
      { is_warmup: true, deleted_at: null },
    ];
    expect(countWorkingSets(sets)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(countWorkingSets([])).toBe(0);
  });
});

describe('isTargetMet', () => {
  it('returns true when workingSetCount >= targetSets', () => {
    expect(isTargetMet(3, 3)).toBe(true);
    expect(isTargetMet(4, 3)).toBe(true);
  });

  it('returns false when workingSetCount < targetSets', () => {
    expect(isTargetMet(2, 3)).toBe(false);
  });

  it('returns false when targetSets is null', () => {
    expect(isTargetMet(5, null)).toBe(false);
  });

  it('returns false when targetSets is 0', () => {
    expect(isTargetMet(5, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TKT-0026 — Duplicate variants
// ---------------------------------------------------------------------------

describe('getDuplicateVariants', () => {
  it('returns 3 variants', () => {
    expect(getDuplicateVariants()).toHaveLength(3);
  });

  it('same variant has 0 deltas', () => {
    const same = getDuplicateVariants().find((v) => v.label === 'duplicate_same');
    expect(same?.weightDelta).toBe(0);
    expect(same?.repsDelta).toBe(0);
  });

  it('+1 rep variant has repsDelta=1 and weightDelta=0', () => {
    const plusRep = getDuplicateVariants().find((v) => v.label === 'duplicate_plus_rep');
    expect(plusRep?.repsDelta).toBe(1);
    expect(plusRep?.weightDelta).toBe(0);
  });

  it('+weight variant uses default increment of 2.5', () => {
    const plusWeight = getDuplicateVariants().find((v) => v.label === 'duplicate_plus_weight');
    expect(plusWeight?.weightDelta).toBe(2.5);
    expect(plusWeight?.repsDelta).toBe(0);
  });

  it('respects custom weight increment', () => {
    const plusWeight = getDuplicateVariants(5).find((v) => v.label === 'duplicate_plus_weight');
    expect(plusWeight?.weightDelta).toBe(5);
  });
});
