/**
 * TKT-0065 — Pure helper: PR celebration notification logic.
 *
 * No expo-notifications imports. No React. No Legend-State. Fully node-testable.
 *
 * detectPR is NOT re-implemented here. This module only interprets its result.
 */

import type { PRResult } from '@/features/session/queries';
import type { UnitEnum } from '@/db';
import { kgToLb } from '@/lib/hypertrophy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PRNotificationKind = '1rm' | 'rep' | null;

export interface PRNotificationDecision {
  /** Which notification to fire, or null (no notification). */
  kind: PRNotificationKind;
  /** Unique notification id. */
  notificationId: string | null;
  /** i18n title key. */
  titleKey: string | null;
  /** i18n body key. */
  bodyKey: string | null;
  /** Interpolation variables for the i18n keys. */
  vars: Record<string, string | number> | null;
}

// ---------------------------------------------------------------------------
// Display weight helper
// ---------------------------------------------------------------------------

/**
 * Convert weight_kg to the user's preferred display value + unit label.
 * Rounds to 1 decimal place.
 */
export function displayWeight(
  weightKg: number,
  unitPreference: UnitEnum,
): { value: number; unit: string } {
  if (unitPreference === 'lb') {
    return { value: Math.round(kgToLb(weightKg) * 10) / 10, unit: 'lb' };
  }
  return { value: Math.round(weightKg * 10) / 10, unit: 'kg' };
}

// ---------------------------------------------------------------------------
// Decision function
// ---------------------------------------------------------------------------

/**
 * Decide whether to fire a PR celebration notification and which content to use.
 *
 * Rules:
 *  1. Master off or prCelebration off → null (no notification).
 *  2. App foregrounded (isForegrounded) → null (PRBadge handles it).
 *  3. Exercise already notified this session (in dedupeSet) → null.
 *  4. Neither is1RM nor isRepPR → null.
 *  5. is1RM → fire 1RM notification.
 *  6. isRepPR only → fire rep-PR notification.
 *
 * The caller must add exerciseId to the dedupeSet AFTER calling this function
 * (if kind !== null).
 */
export function decidePRNotification(opts: {
  prResult: PRResult;
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  unitPreference: UnitEnum;
  isForegrounded: boolean;
  masterEnabled: boolean;
  prCelebrationEnabled: boolean;
  dedupeSet: ReadonlySet<string>;
}): PRNotificationDecision {
  const {
    prResult,
    exerciseId,
    exerciseName,
    weightKg,
    reps,
    unitPreference,
    isForegrounded,
    masterEnabled,
    prCelebrationEnabled,
    dedupeSet,
  } = opts;

  const none: PRNotificationDecision = {
    kind: null,
    notificationId: null,
    titleKey: null,
    bodyKey: null,
    vars: null,
  };

  if (!masterEnabled || !prCelebrationEnabled) return none;
  if (isForegrounded) return none;
  if (dedupeSet.has(exerciseId)) return none;
  if (!prResult.is1RM && !prResult.isRepPR) return none;

  const { value: weightDisplay, unit: unitLabel } = displayWeight(weightKg, unitPreference);
  const notificationId = `pr-${exerciseId}-${Date.now()}`;

  if (prResult.is1RM) {
    return {
      kind: '1rm',
      notificationId,
      titleKey: 'notifications.pr.title_1rm',
      bodyKey: 'notifications.pr.body_1rm',
      vars: {
        exercise: exerciseName,
        weight: weightDisplay,
        unit: unitLabel,
        reps,
      },
    };
  }

  // isRepPR only
  return {
    kind: 'rep',
    notificationId,
    titleKey: 'notifications.pr.title_rep',
    bodyKey: 'notifications.pr.body_rep',
    vars: {
      exercise: exerciseName,
      weight: weightDisplay,
      unit: unitLabel,
      reps,
    },
  };
}
