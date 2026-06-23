/**
 * TKT-0062 — Hook: read and write notification prefs from profiles$.
 *
 * Exposes a stable prefs object and a setter that patches profiles$ immediately
 * (offline-first, syncs in background).
 */

import { useMemo } from 'react';

import type { NotificationPrefs } from '@/db';
import { useRows } from '@/db';
import { useAuth } from '@/lib/auth';
import { getProfile, updateProfile } from '@/features/settings/profile';
import { DEFAULT_REMINDER_TIME } from './constants';

// ---------------------------------------------------------------------------
// Default prefs (applied when notification_prefs is missing or empty)
// ---------------------------------------------------------------------------

export const DEFAULT_NOTIFICATION_PREFS = {
  enabled: false,
  workoutReminders: { enabled: true, time: DEFAULT_REMINDER_TIME },
  inactivity: { enabled: true },
  prCelebration: { enabled: true },
} as const;

// ---------------------------------------------------------------------------
// Resolved prefs (all fields present, with defaults applied)
// ---------------------------------------------------------------------------

export interface ResolvedNotificationPrefs {
  enabled: boolean;
  workoutReminders: { enabled: boolean; time: string };
  inactivity: { enabled: boolean };
  prCelebration: { enabled: boolean };
}

export function resolvePrefs(raw: NotificationPrefs | null | undefined): ResolvedNotificationPrefs {
  return {
    enabled: raw?.enabled ?? DEFAULT_NOTIFICATION_PREFS.enabled,
    workoutReminders: {
      enabled: raw?.workoutReminders?.enabled ?? DEFAULT_NOTIFICATION_PREFS.workoutReminders.enabled,
      time: raw?.workoutReminders?.time ?? DEFAULT_NOTIFICATION_PREFS.workoutReminders.time,
    },
    inactivity: {
      enabled: raw?.inactivity?.enabled ?? DEFAULT_NOTIFICATION_PREFS.inactivity.enabled,
    },
    prCelebration: {
      enabled: raw?.prCelebration?.enabled ?? DEFAULT_NOTIFICATION_PREFS.prCelebration.enabled,
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotificationPrefs() {
  const { db, session } = useAuth();
  const userId = session?.user?.id ?? '';

  const rawProfiles = useRows(db?.profiles$);

  const profile = useMemo(
    () => (rawProfiles ? getProfile(rawProfiles, userId) : null),
    [rawProfiles, userId],
  );

  const prefs = useMemo(
    () => resolvePrefs(profile?.notification_prefs),
    [profile?.notification_prefs],
  );

  const setPrefs = (patch: NotificationPrefs) => {
    if (!db || !userId) return;
    const current = profile?.notification_prefs ?? {};
    updateProfile(db, userId, {
      notification_prefs: { ...current, ...patch },
    });
  };

  return { prefs, setPrefs, isLoading: rawProfiles == null };
}
