/**
 * Tests for pr-notification.ts pure helpers.
 *
 * Node environment — zero expo-notifications or React Native imports.
 */

import { decidePRNotification, displayWeight } from '../pr-notification';
import type { PRResult } from '@/features/session/queries';

// ---------------------------------------------------------------------------
// displayWeight
// ---------------------------------------------------------------------------

describe('displayWeight', () => {
  it('returns kg value as-is', () => {
    const { value, unit } = displayWeight(100, 'kg');
    expect(unit).toBe('kg');
    expect(value).toBeCloseTo(100);
  });

  it('converts kg to lb correctly', () => {
    const { value, unit } = displayWeight(100, 'lb');
    expect(unit).toBe('lb');
    // 100 kg * 2.2046226 = 220.46226 → rounded to 1 decimal = 220.5
    expect(value).toBeCloseTo(220.5, 0);
  });

  it('rounds to 1 decimal', () => {
    const { value } = displayWeight(50, 'lb');
    // 50 * 2.2046226 = 110.23113 → 110.2
    expect(String(value)).toMatch(/^\d+(\.\d)?$/);
  });
});

// ---------------------------------------------------------------------------
// decidePRNotification
// ---------------------------------------------------------------------------

const base = {
  exerciseId: 'ex-1',
  exerciseName: 'Squat',
  weightKg: 100,
  reps: 5,
  unitPreference: 'kg' as const,
  isForegrounded: false,
  masterEnabled: true,
  prCelebrationEnabled: true,
  dedupeSet: new Set<string>(),
};

const pr1RM: PRResult = { is1RM: true, isRepPR: false };
const prRep: PRResult = { is1RM: false, isRepPR: true };
const prBoth: PRResult = { is1RM: true, isRepPR: true };
const prNone: PRResult = { is1RM: false, isRepPR: false };

describe('decidePRNotification', () => {
  it('fires 1RM notification when is1RM is true', () => {
    const result = decidePRNotification({ ...base, prResult: pr1RM });
    expect(result.kind).toBe('1rm');
    expect(result.titleKey).toBe('notifications.pr.title_1rm');
    expect(result.bodyKey).toBe('notifications.pr.body_1rm');
    expect(result.notificationId).not.toBeNull();
    expect(result.vars?.exercise).toBe('Squat');
  });

  it('fires rep notification when only isRepPR is true', () => {
    const result = decidePRNotification({ ...base, prResult: prRep });
    expect(result.kind).toBe('rep');
    expect(result.titleKey).toBe('notifications.pr.title_rep');
    expect(result.bodyKey).toBe('notifications.pr.body_rep');
  });

  it('fires 1RM notification when both is1RM and isRepPR are true (1RM takes priority)', () => {
    const result = decidePRNotification({ ...base, prResult: prBoth });
    expect(result.kind).toBe('1rm');
  });

  it('returns null when neither is1RM nor isRepPR', () => {
    const result = decidePRNotification({ ...base, prResult: prNone });
    expect(result.kind).toBeNull();
  });

  it('returns null when app is foregrounded', () => {
    const result = decidePRNotification({ ...base, prResult: pr1RM, isForegrounded: true });
    expect(result.kind).toBeNull();
  });

  it('returns null when master toggle is off', () => {
    const result = decidePRNotification({ ...base, prResult: pr1RM, masterEnabled: false });
    expect(result.kind).toBeNull();
  });

  it('returns null when prCelebration toggle is off', () => {
    const result = decidePRNotification({
      ...base,
      prResult: pr1RM,
      prCelebrationEnabled: false,
    });
    expect(result.kind).toBeNull();
  });

  it('returns null when exercise already in dedupeSet', () => {
    const dedupeSet = new Set(['ex-1']);
    const result = decidePRNotification({ ...base, prResult: pr1RM, dedupeSet });
    expect(result.kind).toBeNull();
  });

  it('does NOT add to dedupeSet (caller responsibility)', () => {
    const dedupeSet = new Set<string>();
    decidePRNotification({ ...base, prResult: pr1RM, dedupeSet });
    expect(dedupeSet.size).toBe(0);
  });

  it('generates a unique notificationId per call', () => {
    const r1 = decidePRNotification({ ...base, prResult: pr1RM });
    const r2 = decidePRNotification({
      ...base,
      prResult: pr1RM,
      exerciseId: 'ex-2',
      exerciseName: 'Bench',
    });
    expect(r1.notificationId).not.toBe(r2.notificationId);
  });

  it('includes correct weight and unit in vars (kg)', () => {
    const result = decidePRNotification({ ...base, prResult: pr1RM, weightKg: 100 });
    expect(result.vars?.weight).toBeCloseTo(100);
    expect(result.vars?.unit).toBe('kg');
  });

  it('includes correct weight in lb when unitPreference is lb', () => {
    const result = decidePRNotification({
      ...base,
      prResult: pr1RM,
      weightKg: 100,
      unitPreference: 'lb',
    });
    expect(result.vars?.unit).toBe('lb');
    // 100 kg ≈ 220.5 lb
    expect(Number(result.vars?.weight)).toBeGreaterThan(220);
  });
});
