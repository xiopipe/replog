/**
 * Active-time helpers for workout sessions (TKT-0011) — pure, no React Native.
 *
 * The session timer must measure REAL active workout time, not wall-clock time.
 * If the app is backgrounded (screen locked, another app, overnight suspend),
 * that interval must NOT count toward the workout duration.
 *
 * Model
 * -----
 * `accumulated_active_seconds` (persisted on the session row) is the committed
 * total of active time. While the app is in the foreground during an active
 * session, a single in-memory "segment" runs from the moment it became active.
 * The live display is `accumulated + (now - segmentStart)`.
 *
 * The React hook that wires this to AppState lives in `useActiveSessionTimer.ts`
 * (kept separate so these pure helpers can be unit-tested without importing
 * react-native).
 */

// ---------------------------------------------------------------------------
// Constants (product tunables — never magic numbers)
// ---------------------------------------------------------------------------

/** A session reopened after being inactive longer than this is "stale". */
export const STALE_SESSION_THRESHOLD_HOURS = 4;
export const STALE_SESSION_THRESHOLD_MS = STALE_SESSION_THRESHOLD_HOURS * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Live active seconds to display.
 *
 * @param accumulatedSeconds committed active time on the session row
 * @param segmentStartMs     epoch ms when the current foreground segment began,
 *                           or null if no segment is running (paused/completed)
 * @param nowMs              current epoch ms
 */
export function liveActiveSeconds(
  accumulatedSeconds: number,
  segmentStartMs: number | null,
  nowMs: number,
): number {
  const base = Math.max(0, Math.floor(accumulatedSeconds || 0));
  if (segmentStartMs == null) return base;
  const segment = Math.max(0, Math.floor((nowMs - segmentStartMs) / 1000));
  return base + segment;
}

/**
 * Whether a session counts as stale (last active more than the threshold ago).
 *
 * @param lastActiveIso ISO timestamp of the last recorded activity (the session
 *                      row's updated_at, which is bumped on every commit).
 * @param nowMs         current epoch ms
 */
export function isSessionStale(lastActiveIso: string | null, nowMs: number): boolean {
  if (!lastActiveIso) return false;
  const lastMs = new Date(lastActiveIso).getTime();
  if (!Number.isFinite(lastMs)) return false;
  return nowMs - lastMs > STALE_SESSION_THRESHOLD_MS;
}
