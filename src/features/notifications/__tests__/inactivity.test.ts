/**
 * Tests for inactivity.ts pure helpers.
 *
 * Node environment — zero expo-notifications or React Native imports.
 */

import { isRetroactiveSession, computeInactivityDelay, shouldScheduleInactivity } from '../inactivity';
import { INACTIVITY_THRESHOLD_DAYS } from '../constants';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = INACTIVITY_THRESHOLD_DAYS * ONE_DAY_MS;

describe('isRetroactiveSession', () => {
  it('returns false for a session that just ended (now)', () => {
    const nowMs = Date.now();
    const endedAtIso = new Date(nowMs - 30_000).toISOString(); // 30 seconds ago
    expect(isRetroactiveSession(endedAtIso, nowMs)).toBe(false);
  });

  it('returns false for a session that ended within the 5-minute window', () => {
    const nowMs = Date.now();
    const endedAtIso = new Date(nowMs - FIVE_MINUTES_MS + 1000).toISOString();
    expect(isRetroactiveSession(endedAtIso, nowMs)).toBe(false);
  });

  it('returns true for a session that ended more than 5 minutes ago', () => {
    const nowMs = Date.now();
    // More than 5 minutes ago (not exactly equal; boundary is exclusive on "retroactive" side)
    const endedAtIso = new Date(nowMs - FIVE_MINUTES_MS - 1000).toISOString();
    expect(isRetroactiveSession(endedAtIso, nowMs)).toBe(true);
  });

  it('returns true for a retroactive session (hours ago)', () => {
    const nowMs = Date.now();
    const endedAtIso = new Date(nowMs - 2 * ONE_HOUR_MS).toISOString();
    expect(isRetroactiveSession(endedAtIso, nowMs)).toBe(true);
  });

  it('returns true for a retroactive session (days ago)', () => {
    const nowMs = Date.now();
    const endedAtIso = new Date(nowMs - 3 * ONE_DAY_MS).toISOString();
    expect(isRetroactiveSession(endedAtIso, nowMs)).toBe(true);
  });
});

describe('computeInactivityDelay', () => {
  it('returns approximately 3 days in seconds for a recent session', () => {
    // Use a fixed reference time to avoid flakiness.
    // Session ended at 14:00:00 on 2026-06-20 (UTC+0 for determinism via ISO).
    const endedAtIso = '2026-06-20T14:00:00.000Z';
    // nowMs is slightly after ended_at (session just completed).
    const nowMs = new Date('2026-06-20T14:00:30.000Z').getTime();
    const delay = computeInactivityDelay(endedAtIso, nowMs);
    // Target fires at 14:00 on 2026-06-23 (3 days later, same time).
    // Delay from nowMs to target is approximately 3 days minus 30 seconds.
    const threeDeysLessThirtySeconds = THREE_DAYS_MS / 1000 - 30;
    // Allow 1-hour tolerance for rounding to nearest hour.
    expect(delay).toBeGreaterThan(threeDeysLessThirtySeconds - 3600);
    expect(delay).toBeLessThan(THREE_DAYS_MS / 1000 + 3600);
  });

  it('targets noon when the session ended at an odd hour (3am)', () => {
    // Create a fixed reference: session ended at 03:00 today.
    const refDate = new Date('2026-06-20T03:00:00');
    const nowMs = refDate.getTime();
    const endedAtIso = refDate.toISOString();

    const delay = computeInactivityDelay(endedAtIso, nowMs);
    // Target should be noon on the day 3 days later.
    const targetDate = new Date(refDate);
    targetDate.setDate(targetDate.getDate() + INACTIVITY_THRESHOLD_DAYS);
    targetDate.setHours(12, 0, 0, 0);
    const expectedDelay = Math.floor((targetDate.getTime() - nowMs) / 1000);
    // Allow ±3 seconds for rounding.
    expect(Math.abs(delay - expectedDelay)).toBeLessThan(3);
  });

  it('returns at least 1 second (never negative)', () => {
    // Edge case: endedAt far in the future (clock skew).
    const nowMs = Date.now();
    const futureEndedAt = new Date(nowMs + ONE_DAY_MS).toISOString();
    const delay = computeInactivityDelay(futureEndedAt, nowMs);
    expect(delay).toBeGreaterThanOrEqual(1);
  });
});

describe('shouldScheduleInactivity', () => {
  const nowMs = Date.now();
  const recentEndedAt = new Date(nowMs - 30_000).toISOString(); // 30 seconds ago
  const retroactiveEndedAt = new Date(nowMs - 2 * ONE_HOUR_MS).toISOString();

  it('returns shouldSchedule:false when master is disabled', () => {
    const result = shouldScheduleInactivity({
      endedAtIso: recentEndedAt,
      nowMs,
      masterEnabled: false,
      inactivityEnabled: true,
    });
    expect(result.shouldSchedule).toBe(false);
  });

  it('returns shouldSchedule:false when inactivity toggle is disabled', () => {
    const result = shouldScheduleInactivity({
      endedAtIso: recentEndedAt,
      nowMs,
      masterEnabled: true,
      inactivityEnabled: false,
    });
    expect(result.shouldSchedule).toBe(false);
  });

  it('returns shouldSchedule:false for retroactive session', () => {
    const result = shouldScheduleInactivity({
      endedAtIso: retroactiveEndedAt,
      nowMs,
      masterEnabled: true,
      inactivityEnabled: true,
    });
    expect(result.shouldSchedule).toBe(false);
  });

  it('returns shouldSchedule:true with positive delay for real-time completion', () => {
    const result = shouldScheduleInactivity({
      endedAtIso: recentEndedAt,
      nowMs,
      masterEnabled: true,
      inactivityEnabled: true,
    });
    expect(result.shouldSchedule).toBe(true);
    expect(result.delaySeconds).toBeGreaterThan(0);
  });
});
