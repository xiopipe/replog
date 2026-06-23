/**
 * TKT-0064 — Pure helper: inactivity re-engagement notification logic.
 *
 * No expo-notifications imports. No React. No Legend-State. Fully node-testable.
 */

import { INACTIVITY_THRESHOLD_DAYS } from './constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InactivityScheduleResult {
  /** Whether the inactivity notification should be (re-)scheduled. */
  shouldSchedule: boolean;
  /** Time interval in seconds until the notification fires. */
  delaySeconds: number;
}

// ---------------------------------------------------------------------------
// Retroactive session detection
// ---------------------------------------------------------------------------

/**
 * Return true if the session was logged retroactively — i.e., its ended_at
 * is more than RETROACTIVE_WINDOW_MS before the current wall-clock time.
 *
 * "A few minutes" tolerance: 5 minutes.
 */
const RETROACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function isRetroactiveSession(
  endedAtIso: string,
  nowMs: number = Date.now(),
): boolean {
  const endedAtMs = new Date(endedAtIso).getTime();
  return nowMs - endedAtMs > RETROACTIVE_WINDOW_MS;
}

// ---------------------------------------------------------------------------
// Firing-time calculation
// ---------------------------------------------------------------------------

/**
 * Compute the delay in seconds until the inactivity notification should fire,
 * given the session's ended_at timestamp.
 *
 * Strategy: fire at approximately the same time of day as ended_at, but
 * INACTIVITY_THRESHOLD_DAYS days later. Round to the nearest hour.
 * If the resulting local hour is between 00:00 and 06:00 (odd hours), use 12:00.
 *
 * Returns total seconds as a TimeIntervalTrigger delay from now.
 */
export function computeInactivityDelay(
  endedAtIso: string,
  nowMs: number = Date.now(),
): number {
  const endedAtMs = new Date(endedAtIso).getTime();

  // Round ended_at to the nearest hour.
  const roundedMs = Math.round(endedAtMs / 3_600_000) * 3_600_000;
  const roundedDate = new Date(roundedMs);

  // Use local hours to detect "odd" times (midnight to 6am).
  const localHour = roundedDate.getHours();

  let targetMs: number;
  if (localHour >= 0 && localHour < 6) {
    // Odd hour: fire at noon on the target day.
    const baseDayMs = new Date(
      roundedDate.getFullYear(),
      roundedDate.getMonth(),
      roundedDate.getDate(),
      12,
      0,
      0,
      0,
    ).getTime();
    targetMs = baseDayMs + INACTIVITY_THRESHOLD_DAYS * 86_400_000;
  } else {
    targetMs = roundedMs + INACTIVITY_THRESHOLD_DAYS * 86_400_000;
  }

  // Ensure the target is in the future (guard against clock skew).
  const delayMs = Math.max(targetMs - nowMs, 1000);
  return Math.floor(delayMs / 1000);
}

// ---------------------------------------------------------------------------
// Schedule decision
// ---------------------------------------------------------------------------

/**
 * Decide whether to schedule an inactivity notification after a session completion.
 *
 * Returns { shouldSchedule: false } if:
 *  - The session is retroactive.
 *  - The inactivity notification type is disabled.
 *  - The master notifications toggle is off.
 */
export function shouldScheduleInactivity(opts: {
  endedAtIso: string;
  nowMs?: number;
  masterEnabled: boolean;
  inactivityEnabled: boolean;
}): InactivityScheduleResult {
  const nowMs = opts.nowMs ?? Date.now();

  if (!opts.masterEnabled || !opts.inactivityEnabled) {
    return { shouldSchedule: false, delaySeconds: 0 };
  }

  if (isRetroactiveSession(opts.endedAtIso, nowMs)) {
    return { shouldSchedule: false, delaySeconds: 0 };
  }

  return {
    shouldSchedule: true,
    delaySeconds: computeInactivityDelay(opts.endedAtIso, nowMs),
  };
}
