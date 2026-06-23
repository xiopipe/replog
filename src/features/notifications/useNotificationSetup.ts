/**
 * TKT-0062/0063/0064 — Hook: app-root notification setup.
 *
 * Called once from the authenticated root (RootNavigator after session exists).
 * Responsibilities:
 *   1. Create Android channel (idempotent).
 *   2. Install foreground handler (suppress heads-up banners).
 *   3. Subscribe to plan observable — reconcile workout reminders on change.
 *   4. Subscribe to workoutSessions observable — manage inactivity notification.
 *
 * React-19 rule: NO synchronous setState in useEffect.
 * All async work is fire-and-forget inside effects; no state updates in the
 * async callbacks themselves.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { observe } from '@legendapp/state';

import type { PlanRow, PlanDayRow, RoutineRow, WorkoutSessionRow } from '@/db';
import { useAuth } from '@/lib/auth';
import {
  installForegroundHandler,
  ensureAndroidChannel,
  getAllScheduledIds,
  reconcileReminders,
  scheduleInactivityNotification,
  cancelNotification,
  cancelAllNotifications,
} from './service';
import { deriveReminderSlots, diffReminderSlots } from './reminder-schedule';
import { shouldScheduleInactivity } from './inactivity';
import { resolvePrefs } from './useNotificationPrefs';
import { INACTIVITY_NOTIFICATION_ID, INACTIVITY_THRESHOLD_DAYS } from './constants';

export function useNotificationSetup() {
  const { db } = useAuth();
  const { t } = useTranslation();

  // Track previous session statuses to detect transitions to 'completed'.
  const prevSessionStatusesRef = useRef<Record<string, string>>({});

  // One-time setup: Android channel + foreground handler.
  useEffect(() => {
    installForegroundHandler();
    ensureAndroidChannel().catch(() => {
      // Non-fatal — channel will be created on next launch.
    });
  }, []);

  // Subscribe to plan/planDays/routines + prefs for reminder scheduling.
  useEffect(() => {
    if (!db) return;

    const dispose = observe(() => {
      // Read observables to subscribe to changes.
      const plansSnap: Record<string, PlanRow> =
        (db.plans$ as any).get?.() ?? {};
      const planDaysSnap: Record<string, PlanDayRow> =
        (db.planDays$ as any).get?.() ?? {};
      const routinesSnap: Record<string, RoutineRow> =
        (db.routines$ as any).get?.() ?? {};
      const profilesSnap =
        (db.profiles$ as any).get?.() ?? {};

      // Extract prefs from first profile entry (keyed by userId).
      const profileValues = Object.values(profilesSnap) as { notification_prefs?: unknown }[];
      const rawPrefs = profileValues[0]?.notification_prefs ?? null;
      const prefs = resolvePrefs(rawPrefs as any);

      const reminderTime = prefs.workoutReminders.time;
      const remindersEnabled = prefs.enabled && prefs.workoutReminders.enabled;

      if (!remindersEnabled) {
        // Cancel all reminder notifications asynchronously.
        getAllScheduledIds()
          .then((ids) => {
            const reminderIds = ids.filter((id) => id.startsWith('reminder-planday-'));
            return Promise.all(reminderIds.map((id) => cancelNotification(id)));
          })
          .catch(() => {});
        return;
      }

      const slots = deriveReminderSlots(
        plansSnap,
        planDaysSnap,
        routinesSnap,
        reminderTime,
      );

      getAllScheduledIds()
        .then((scheduledIds) => {
          const { toCancel, toSchedule } = diffReminderSlots(slots, scheduledIds);
          return reconcileReminders(toCancel, toSchedule, (slot) => ({
            title: t('notifications.reminder.title'),
            body: t('notifications.reminder.body', { routineName: slot.routineName }),
          }));
        })
        .catch(() => {});
    });

    return () => dispose();
  // t is stable from react-i18next; db reference is stable per user session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  // Subscribe to workoutSessions for inactivity notification management.
  useEffect(() => {
    if (!db) return;

    const dispose = observe(() => {
      const sessionsSnap: Record<string, WorkoutSessionRow> =
        (db.workoutSessions$ as any).get?.() ?? {};
      const profilesSnap =
        (db.profiles$ as any).get?.() ?? {};

      const profileValues = Object.values(profilesSnap) as { notification_prefs?: unknown }[];
      const rawPrefs = profileValues[0]?.notification_prefs ?? null;
      const prefs = resolvePrefs(rawPrefs as any);

      // Detect newly-completed sessions (transition from non-completed → completed).
      const nowMs = Date.now();

      for (const session of Object.values(sessionsSnap)) {
        if (session.deleted_at) continue;
        const prevStatus = prevSessionStatusesRef.current[session.id];
        const currentStatus = session.status;

        if (currentStatus === 'completed' && prevStatus !== 'completed') {
          // Transition detected.
          const endedAt = session.ended_at ?? new Date().toISOString();
          const decision = shouldScheduleInactivity({
            endedAtIso: endedAt,
            nowMs,
            masterEnabled: prefs.enabled,
            inactivityEnabled: prefs.inactivity.enabled,
          });

          if (decision.shouldSchedule) {
            // Cancel existing, schedule new.
            cancelNotification(INACTIVITY_NOTIFICATION_ID)
              .then(() =>
                scheduleInactivityNotification({
                  notificationId: INACTIVITY_NOTIFICATION_ID,
                  title: t('notifications.inactivity.title'),
                  body: t('notifications.inactivity.body', {
                    days: INACTIVITY_THRESHOLD_DAYS,
                  }),
                  delaySeconds: decision.delaySeconds,
                }),
              )
              .catch(() => {});
          }
        }
      }

      // Update prev statuses.
      for (const session of Object.values(sessionsSnap)) {
        prevSessionStatusesRef.current[session.id] = session.status;
      }

      // If master or inactivity disabled: cancel any pending.
      if (!prefs.enabled || !prefs.inactivity.enabled) {
        cancelNotification(INACTIVITY_NOTIFICATION_ID).catch(() => {});
      }
    });

    return () => dispose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  // When prefs.enabled goes to false, cancel ALL scheduled notifications.
  useEffect(() => {
    if (!db) return;

    const dispose = observe(() => {
      const profilesSnap =
        (db.profiles$ as any).get?.() ?? {};
      const profileValues = Object.values(profilesSnap) as { notification_prefs?: unknown }[];
      const rawPrefs = profileValues[0]?.notification_prefs ?? null;
      const prefs = resolvePrefs(rawPrefs as any);

      if (!prefs.enabled) {
        cancelAllNotifications().catch(() => {});
      }
    });

    return () => dispose();
  }, [db]);
}
