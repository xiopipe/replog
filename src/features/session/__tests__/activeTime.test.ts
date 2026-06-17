/**
 * TKT-0011 — pure-helper tests for the active-time tracker.
 *
 * These cover the time math that fixes the wall-clock bug; the React hook
 * (AppState wiring) is exercised manually on device.
 */

import {
  liveActiveSeconds,
  isSessionStale,
  STALE_SESSION_THRESHOLD_MS,
} from '../activeTime';

describe('liveActiveSeconds', () => {
  it('returns only the accumulated base when no segment is running (paused)', () => {
    expect(liveActiveSeconds(120, null, 1_000_000)).toBe(120);
  });

  it('adds the elapsed foreground segment to the accumulated base', () => {
    const start = 1_000_000;
    const now = start + 30_000; // 30s later
    expect(liveActiveSeconds(120, start, now)).toBe(150);
  });

  it('never goes negative on clock skew or bad input', () => {
    expect(liveActiveSeconds(0, 2_000_000, 1_000_000)).toBe(0);
    expect(liveActiveSeconds(-5, null, 0)).toBe(0);
  });

  it('floors fractional seconds', () => {
    const start = 0;
    expect(liveActiveSeconds(0, start, 1999)).toBe(1);
  });
});

describe('isSessionStale', () => {
  const now = 10_000_000_000_000;

  it('is false for recent activity', () => {
    const recent = new Date(now - 60_000).toISOString(); // 1 min ago
    expect(isSessionStale(recent, now)).toBe(false);
  });

  it('is true past the threshold', () => {
    const old = new Date(now - STALE_SESSION_THRESHOLD_MS - 1000).toISOString();
    expect(isSessionStale(old, now)).toBe(true);
  });

  it('is false exactly at the threshold boundary', () => {
    const boundary = new Date(now - STALE_SESSION_THRESHOLD_MS).toISOString();
    expect(isSessionStale(boundary, now)).toBe(false);
  });

  it('is false for null or malformed timestamps', () => {
    expect(isSessionStale(null, now)).toBe(false);
    expect(isSessionStale('not-a-date', now)).toBe(false);
  });
});
