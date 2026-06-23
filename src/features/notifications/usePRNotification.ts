/**
 * TKT-0065 — Hook: session-scoped PR celebration notification dedup.
 *
 * Provides a function to call after detectPR returns a positive result.
 * Maintains an in-memory Set<exerciseId> that resets when the session ends.
 *
 * This hook is used inside the session screen (app/session/[id].tsx or its
 * add-set handler). It must NOT be mounted globally — the dedup set is
 * session-scoped.
 *
 * React-19 rule: NO synchronous setState in useEffect.
 * No state is set from async callbacks here.
 */

import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PRResult } from '@/features/session/queries';
import type { UnitEnum } from '@/db';
import { decidePRNotification } from './pr-notification';
import { firePRNotification } from './service';

interface UsePRNotificationOpts {
  masterEnabled: boolean;
  prCelebrationEnabled: boolean;
  unitPreference: UnitEnum;
}

export function usePRNotification({
  masterEnabled,
  prCelebrationEnabled,
  unitPreference,
}: UsePRNotificationOpts) {
  const { t } = useTranslation();
  // Session-scoped dedup: exerciseIds already notified this session.
  const notifiedRef = useRef<Set<string>>(new Set());

  /**
   * Call this after a set is saved and detectPR has been run.
   * Fires a background notification if appropriate.
   */
  const onPRDetected = useCallback(
    (opts: {
      prResult: PRResult;
      exerciseId: string;
      exerciseName: string;
      weightKg: number;
      reps: number;
    }) => {
      const { prResult, exerciseId, exerciseName, weightKg, reps } = opts;

      // Check if app is foregrounded.
      const isForegrounded = AppState.currentState === 'active';

      const decision = decidePRNotification({
        prResult,
        exerciseId,
        exerciseName,
        weightKg,
        reps,
        unitPreference,
        isForegrounded,
        masterEnabled,
        prCelebrationEnabled,
        dedupeSet: notifiedRef.current,
      });

      if (decision.kind === null || !decision.notificationId) return;

      // Add to dedup set immediately (before async fire).
      notifiedRef.current.add(exerciseId);

      const title = t(decision.titleKey!, decision.vars as Record<string, string | number>);
      const body = t(decision.bodyKey!, decision.vars as Record<string, string | number>);

      firePRNotification({
        notificationId: decision.notificationId,
        title,
        body,
      }).catch(() => {
        // Non-fatal — notification failed silently; dedup still applied.
      });
    },
    [masterEnabled, prCelebrationEnabled, unitPreference, t],
  );

  /** Call when the session ends to clear the dedup set. */
  const clearDedup = useCallback(() => {
    notifiedRef.current.clear();
  }, []);

  return { onPRDetected, clearDedup };
}
