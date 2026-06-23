/**
 * TKT-0064: Notification constants.
 *
 * INACTIVITY_THRESHOLD_DAYS is the single source of truth for the inactivity
 * re-engagement delay. Import this constant everywhere — never hardcode 3.
 */

/** Number of days without a completed workout before the inactivity notification fires. */
export const INACTIVITY_THRESHOLD_DAYS = 3;

/** Android notification channel used for all RepLog local notifications. */
export const NOTIFICATION_CHANNEL_ID = 'replog_default';

/** Identifier for the single in-flight inactivity notification. */
export const INACTIVITY_NOTIFICATION_ID = 'inactivity-reengagement';

/** Prefix for workout reminder notification identifiers. */
export const REMINDER_ID_PREFIX = 'reminder-planday-';

/** Default reminder time used when the user first enables workout reminders. */
export const DEFAULT_REMINDER_TIME = '18:00';
