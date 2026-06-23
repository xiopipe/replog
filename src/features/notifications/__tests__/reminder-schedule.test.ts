/**
 * Tests for reminder-schedule.ts pure helpers.
 *
 * Node environment — zero expo-notifications or React Native imports.
 */

import {
  appWeekdayToExpo,
  parseReminderTime,
  deriveReminderSlots,
  diffReminderSlots,
} from '../reminder-schedule';
import type { PlanRow, PlanDayRow, RoutineRow } from '@/db';
import { REMINDER_ID_PREFIX } from '../constants';

// ---------------------------------------------------------------------------
// appWeekdayToExpo
// ---------------------------------------------------------------------------

describe('appWeekdayToExpo', () => {
  it('maps Monday (0) → 2', () => {
    expect(appWeekdayToExpo(0)).toBe(2);
  });
  it('maps Tuesday (1) → 3', () => {
    expect(appWeekdayToExpo(1)).toBe(3);
  });
  it('maps Wednesday (2) → 4', () => {
    expect(appWeekdayToExpo(2)).toBe(4);
  });
  it('maps Thursday (3) → 5', () => {
    expect(appWeekdayToExpo(3)).toBe(5);
  });
  it('maps Friday (4) → 6', () => {
    expect(appWeekdayToExpo(4)).toBe(6);
  });
  it('maps Saturday (5) → 7', () => {
    expect(appWeekdayToExpo(5)).toBe(7);
  });
  it('maps Sunday (6) → 1', () => {
    expect(appWeekdayToExpo(6)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// parseReminderTime
// ---------------------------------------------------------------------------

describe('parseReminderTime', () => {
  it('parses "18:00"', () => {
    expect(parseReminderTime('18:00')).toEqual({ hour: 18, minute: 0 });
  });
  it('parses "09:30"', () => {
    expect(parseReminderTime('09:30')).toEqual({ hour: 9, minute: 30 });
  });
  it('parses "7:05"', () => {
    expect(parseReminderTime('7:05')).toEqual({ hour: 7, minute: 5 });
  });
  it('returns default for empty string', () => {
    expect(parseReminderTime('')).toEqual({ hour: 18, minute: 0 });
  });
  it('returns default for invalid format', () => {
    expect(parseReminderTime('bad')).toEqual({ hour: 18, minute: 0 });
  });
  it('returns default for out-of-range hour', () => {
    expect(parseReminderTime('25:00')).toEqual({ hour: 18, minute: 0 });
  });
  it('returns default for out-of-range minute', () => {
    expect(parseReminderTime('10:61')).toEqual({ hour: 18, minute: 0 });
  });
});

// ---------------------------------------------------------------------------
// deriveReminderSlots
// ---------------------------------------------------------------------------

const makePlan = (id: string, isActive: boolean): PlanRow => ({
  id,
  user_id: 'u1',
  name: 'Plan',
  is_active: isActive,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
});

const makePlanDay = (
  id: string,
  planId: string,
  routineId: string,
  weekday: number | null,
  deleted = false,
): PlanDayRow => ({
  id,
  user_id: 'u1',
  plan_id: planId,
  routine_id: routineId,
  order_index: 0,
  weekday,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: deleted ? '2026-01-02T00:00:00Z' : null,
});

const makeRoutine = (id: string, name: string, deleted = false): RoutineRow => ({
  id,
  user_id: 'u1',
  name,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: deleted ? '2026-01-02T00:00:00Z' : null,
});

describe('deriveReminderSlots', () => {
  it('returns empty when no active plan', () => {
    const plans = { p1: makePlan('p1', false) };
    const planDays = { d1: makePlanDay('d1', 'p1', 'r1', 0) };
    const routines = { r1: makeRoutine('r1', 'Push') };
    expect(deriveReminderSlots(plans, planDays, routines, '18:00')).toEqual([]);
  });

  it('returns empty when all plan days are flexible (weekday null)', () => {
    const plans = { p1: makePlan('p1', true) };
    const planDays = { d1: makePlanDay('d1', 'p1', 'r1', null) };
    const routines = { r1: makeRoutine('r1', 'Push') };
    expect(deriveReminderSlots(plans, planDays, routines, '18:00')).toEqual([]);
  });

  it('skips deleted plan days', () => {
    const plans = { p1: makePlan('p1', true) };
    const planDays = { d1: makePlanDay('d1', 'p1', 'r1', 0, true) };
    const routines = { r1: makeRoutine('r1', 'Push') };
    expect(deriveReminderSlots(plans, planDays, routines, '18:00')).toEqual([]);
  });

  it('skips plan days whose routine is deleted', () => {
    const plans = { p1: makePlan('p1', true) };
    const planDays = { d1: makePlanDay('d1', 'p1', 'r1', 1) };
    const routines = { r1: makeRoutine('r1', 'Push', true) };
    expect(deriveReminderSlots(plans, planDays, routines, '18:00')).toEqual([]);
  });

  it('produces a slot with correct expo weekday for Monday (0)', () => {
    const plans = { p1: makePlan('p1', true) };
    const planDays = { d1: makePlanDay('d1', 'p1', 'r1', 0) };
    const routines = { r1: makeRoutine('r1', 'Push') };
    const slots = deriveReminderSlots(plans, planDays, routines, '18:00');
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      id: `${REMINDER_ID_PREFIX}d1`,
      weekday: 2, // Monday
      hour: 18,
      minute: 0,
      routineName: 'Push',
    });
  });

  it('produces slots for multiple plan days with correct expo weekdays', () => {
    const plans = { p1: makePlan('p1', true) };
    const planDays = {
      d1: makePlanDay('d1', 'p1', 'r1', 0), // Monday
      d2: makePlanDay('d2', 'p1', 'r2', 6), // Sunday
      d3: makePlanDay('d3', 'p1', 'r1', null), // flexible — skip
    };
    const routines = {
      r1: makeRoutine('r1', 'Push'),
      r2: makeRoutine('r2', 'Pull'),
    };
    const slots = deriveReminderSlots(plans, planDays, routines, '09:30');
    expect(slots).toHaveLength(2);
    const mon = slots.find((s) => s.id === `${REMINDER_ID_PREFIX}d1`);
    const sun = slots.find((s) => s.id === `${REMINDER_ID_PREFIX}d2`);
    expect(mon?.weekday).toBe(2); // Monday
    expect(sun?.weekday).toBe(1); // Sunday
    expect(mon?.hour).toBe(9);
    expect(mon?.minute).toBe(30);
    expect(sun?.routineName).toBe('Pull');
  });

  it('does not include days from a different plan', () => {
    const plans = {
      p1: makePlan('p1', true),
      p2: makePlan('p2', false),
    };
    const planDays = {
      d1: makePlanDay('d1', 'p1', 'r1', 0),
      d2: makePlanDay('d2', 'p2', 'r2', 1),
    };
    const routines = {
      r1: makeRoutine('r1', 'Push'),
      r2: makeRoutine('r2', 'Pull'),
    };
    const slots = deriveReminderSlots(plans, planDays, routines, '18:00');
    expect(slots).toHaveLength(1);
    expect(slots[0]?.id).toBe(`${REMINDER_ID_PREFIX}d1`);
  });
});

// ---------------------------------------------------------------------------
// diffReminderSlots
// ---------------------------------------------------------------------------

describe('diffReminderSlots', () => {
  it('cancels all reminder IDs and reschedules desired slots', () => {
    const desired = [
      { id: `${REMINDER_ID_PREFIX}d1`, weekday: 2, hour: 18, minute: 0, routineName: 'Push' },
    ];
    const scheduledIds = [`${REMINDER_ID_PREFIX}d1`, `${REMINDER_ID_PREFIX}d2`, 'inactivity-reengagement'];
    const { toCancel, toSchedule } = diffReminderSlots(desired, scheduledIds);
    // Only reminder IDs are cancelled
    expect(toCancel).toContain(`${REMINDER_ID_PREFIX}d1`);
    expect(toCancel).toContain(`${REMINDER_ID_PREFIX}d2`);
    expect(toCancel).not.toContain('inactivity-reengagement');
    expect(toSchedule).toEqual(desired);
  });

  it('returns empty toCancel when no reminder IDs scheduled', () => {
    const desired = [
      { id: `${REMINDER_ID_PREFIX}d1`, weekday: 2, hour: 18, minute: 0, routineName: 'Push' },
    ];
    const { toCancel } = diffReminderSlots(desired, ['inactivity-reengagement']);
    expect(toCancel).toHaveLength(0);
  });

  it('returns empty toSchedule when no desired slots', () => {
    const { toSchedule } = diffReminderSlots([], [`${REMINDER_ID_PREFIX}d1`]);
    expect(toSchedule).toHaveLength(0);
  });
});
