/**
 * TKT-0062/0063/0064/0065 — Notification service.
 *
 * Thin wrapper around expo-notifications. This is the ONLY module that imports
 * expo-notifications. All scheduling/decision logic lives in the pure helpers:
 *   reminder-schedule.ts, inactivity.ts, pr-notification.ts
 *
 * Callers import this module; pure helpers never import it (keeps them node-testable).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NOTIFICATION_CHANNEL_ID } from './constants';
import type { ReminderSlot } from './reminder-schedule';

// ---------------------------------------------------------------------------
// Foreground handler (TKT-0062 AC)
// Suppress heads-up banners — the in-app PRBadge handles foreground state.
// ---------------------------------------------------------------------------

export function installForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: true,
    }),
  });
}

// ---------------------------------------------------------------------------
// Android channel (TKT-0062 AC) — idempotent
// ---------------------------------------------------------------------------

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'RepLog',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2F6FB0',
  });
}

// ---------------------------------------------------------------------------
// Scheduled notification queries
// ---------------------------------------------------------------------------

export async function getAllScheduledIds(): Promise<string[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((n) => n.identifier);
}

// ---------------------------------------------------------------------------
// Cancel helpers
// ---------------------------------------------------------------------------

export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ---------------------------------------------------------------------------
// TKT-0063 — Workout reminder scheduling
// ---------------------------------------------------------------------------

/**
 * Schedule a weekly repeating reminder notification for one plan-day slot.
 * Uses CalendarTriggerInput with repeats: true.
 */
export async function scheduleReminderNotification(
  slot: ReminderSlot,
  body: string,
  title: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: slot.id,
    content: {
      title,
      body,
      sound: true,
      data: { type: 'workout_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats: true,
      weekday: slot.weekday,
      hour: slot.hour,
      minute: slot.minute,
    },
  });
}

/**
 * Reconcile: cancel stale reminder IDs then schedule the desired slots.
 * Idempotent — safe to call with the same slots multiple times.
 */
export async function reconcileReminders(
  toCancel: string[],
  toSchedule: ReminderSlot[],
  buildContent: (slot: ReminderSlot) => { title: string; body: string },
): Promise<void> {
  // Cancel stale
  await Promise.all(toCancel.map((id) => cancelNotification(id)));

  // Schedule desired
  await Promise.all(
    toSchedule.map((slot) => {
      const { title, body } = buildContent(slot);
      return scheduleReminderNotification(slot, body, title);
    }),
  );
}

// ---------------------------------------------------------------------------
// TKT-0064 — Inactivity notification
// ---------------------------------------------------------------------------

/**
 * Schedule the inactivity re-engagement notification.
 * Uses TimeIntervalTriggerInput (one-shot, not repeating).
 */
export async function scheduleInactivityNotification(opts: {
  notificationId: string;
  title: string;
  body: string;
  delaySeconds: number;
}): Promise<void> {
  const { notificationId, title, body, delaySeconds } = opts;
  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title,
      body,
      sound: true,
      data: { type: 'inactivity' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
      repeats: false,
    },
  });
}

// ---------------------------------------------------------------------------
// TKT-0065 — PR celebration notification
// ---------------------------------------------------------------------------

/**
 * Fire a PR celebration notification immediately (null trigger).
 * Only called when the app is backgrounded — the foreground handler suppresses
 * heads-up banners, so calling this while foregrounded is a no-op visually.
 */
export async function firePRNotification(opts: {
  notificationId: string;
  title: string;
  body: string;
}): Promise<void> {
  const { notificationId, title, body } = opts;
  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title,
      body,
      sound: true,
      data: { type: 'pr_celebration' },
    },
    trigger: null,
  });
}
