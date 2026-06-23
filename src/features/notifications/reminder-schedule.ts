/**
 * TKT-0063 — Pure helper: derive the set of weekly reminder slots from plan state.
 *
 * No expo-notifications imports. No React. No Legend-State. Fully node-testable.
 */

import type { PlanRow, PlanDayRow, RoutineRow } from '@/db';
import { REMINDER_ID_PREFIX } from './constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One scheduled-reminder slot derived from a plan day.
 * weekday follows the expo-notifications CalendarTriggerInput convention:
 *   1 = Sunday, 2 = Monday, … 7 = Saturday (ISO weekday 0-6 → +2, wrap)
 */
export interface ReminderSlot {
  /** Notification identifier. e.g. "reminder-planday-<planDayId>" */
  id: string;
  /** expo-notifications weekday (1–7, 1=Sunday). */
  weekday: number;
  hour: number;
  minute: number;
  routineName: string;
}

// ---------------------------------------------------------------------------
// Weekday mapping
// ---------------------------------------------------------------------------

/**
 * Convert the app's weekday encoding (0=Monday … 6=Sunday) to
 * expo-notifications CalendarTriggerInput weekday (1=Sunday … 7=Saturday).
 *
 * App encoding:  0 Mo, 1 Tu, 2 We, 3 Th, 4 Fr, 5 Sa, 6 Su
 * Expo encoding: 2 Mo, 3 Tu, 4 We, 5 Th, 6 Fr, 7 Sa, 1 Su
 */
export function appWeekdayToExpo(appWeekday: number): number {
  // Sunday (6) → 1; others shift by +2, wrap at 8 → 1
  return appWeekday === 6 ? 1 : appWeekday + 2;
}

// ---------------------------------------------------------------------------
// Reminder time parsing
// ---------------------------------------------------------------------------

/**
 * Parse "HH:mm" string into { hour, minute }.
 * Returns { hour: 18, minute: 0 } on invalid input.
 */
export function parseReminderTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
  if (!match) return { hour: 18, minute: 0 };
  const hour = parseInt(match[1]!, 10);
  const minute = parseInt(match[2]!, 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return { hour: 18, minute: 0 };
  return { hour, minute };
}

// ---------------------------------------------------------------------------
// Slot derivation
// ---------------------------------------------------------------------------

/**
 * Derive the list of ReminderSlots from the current plan/plan-day/routine state.
 *
 * Rules:
 *  - Only days with a non-null weekday produce a slot.
 *  - The plan must be active (is_active === true, deleted_at === null).
 *  - plan_day must not be deleted.
 *  - The routine must exist and not be deleted.
 */
export function deriveReminderSlots(
  plans: Record<string, PlanRow>,
  planDays: Record<string, PlanDayRow>,
  routines: Record<string, RoutineRow>,
  reminderTime: string,
): ReminderSlot[] {
  const { hour, minute } = parseReminderTime(reminderTime);

  // Find the single active plan.
  const activePlan = Object.values(plans).find(
    (p) => p.is_active && !p.deleted_at,
  );
  if (!activePlan) return [];

  const slots: ReminderSlot[] = [];

  for (const day of Object.values(planDays)) {
    if (day.deleted_at) continue;
    if (day.plan_id !== activePlan.id) continue;
    if (day.weekday == null) continue; // flexible day — skip

    const routine = routines[day.routine_id];
    if (!routine || routine.deleted_at) continue;

    slots.push({
      id: `${REMINDER_ID_PREFIX}${day.id}`,
      weekday: appWeekdayToExpo(day.weekday),
      hour,
      minute,
      routineName: routine.name,
    });
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Idempotent reconcile diff
// ---------------------------------------------------------------------------

/**
 * Given the desired slots and the set of currently-scheduled notification IDs,
 * return which IDs to cancel and which slots to schedule.
 *
 * Strategy: cancel-all-then-reschedule (idempotent). If the desired set equals
 * the scheduled set (same IDs), still reschedule — time might have changed.
 */
export function diffReminderSlots(
  desiredSlots: ReminderSlot[],
  scheduledIds: string[],
): { toCancel: string[]; toSchedule: ReminderSlot[] } {
  // Only consider reminder IDs (ignore other notification types).
  const reminderScheduledIds = scheduledIds.filter((id) =>
    id.startsWith(REMINDER_ID_PREFIX),
  );

  return {
    toCancel: reminderScheduledIds,
    toSchedule: desiredSlots,
  };
}
