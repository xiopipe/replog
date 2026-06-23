/**
 * Pure helpers for the per-exercise history view (TKT-0040).
 *
 * Groups sets from getExerciseHistorySets by session, detects which historical
 * sets were PRs at the time they were logged, and surfaces the session_id so
 * the caller can navigate to the session detail screen.
 *
 * No React Native / Legend-State imports — pure data transforms for easy testing.
 */

import type { SetRow, SessionExerciseRow } from '@/db';
import { estimated1RM } from '@/lib/hypertrophy';
import { detectPR } from '@/features/session/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistorySet {
  set: SetRow;
  /** True if this set was a PR (1RM or rep) at the time it was logged, compared
   *  to all sets from sessions older than this one for the same exercise. */
  isPR: boolean;
}

export interface HistorySession {
  /** The workout_sessions.id that contains these sets. */
  sessionId: string;
  /** ISO string of the session's started_at — used for display and navigation. */
  startedAt: string;
  sets: HistorySet[];
}

// ---------------------------------------------------------------------------
// buildExerciseHistorySessions
// ---------------------------------------------------------------------------

/**
 * Given a flat list of working sets for one exercise (from getExerciseHistorySets),
 * group them by session and annotate each set with its PR status at log time.
 *
 * PR-at-log-time: a set in session S is a PR if it beats the best among all sets
 * from sessions that started BEFORE S.  Sets within the same session do not count
 * as "history" for each other (matches the detectPR logic used during live logging).
 *
 * Result is sorted descending by startedAt (most-recent session first).
 *
 * @param sets                - All working sets for the exercise (no warmups).
 * @param sessionExercises    - Full sessionExercises snapshot (for session_id lookup).
 * @param sessions            - Map of session_id → { started_at } (lightweight).
 */
export function buildExerciseHistorySessions(
  sets: SetRow[],
  sessionExercises: Record<string, SessionExerciseRow>,
  sessions: Record<string, { started_at: string }>,
): HistorySession[] {
  if (sets.length === 0) return [];

  // Build a map: set.session_exercise_id → session_id + started_at
  const seInfo = new Map<string, { sessionId: string; startedAt: string }>();
  for (const se of Object.values(sessionExercises)) {
    if (se.deleted_at) continue;
    const session = sessions[se.session_id];
    if (!session) continue;
    seInfo.set(se.id, { sessionId: se.session_id, startedAt: session.started_at });
  }

  // Group sets by session
  const bySession = new Map<string, { startedAt: string; sets: SetRow[] }>();
  for (const set of sets) {
    const info = seInfo.get(set.session_exercise_id);
    if (!info) continue;
    let group = bySession.get(info.sessionId);
    if (!group) {
      group = { startedAt: info.startedAt, sets: [] };
      bySession.set(info.sessionId, group);
    }
    group.sets.push(set);
  }

  // Sort sessions descending by startedAt for final output
  const sortedSessions = Array.from(bySession.entries()).sort(
    ([, a], [, b]) => b.startedAt.localeCompare(a.startedAt),
  );

  // For PR detection: build ordered list of session ids from oldest to newest
  const sessionsByDate = Array.from(bySession.entries()).sort(
    ([, a], [, b]) => a.startedAt.localeCompare(b.startedAt),
  );

  // Accumulate history: as we process sessions from oldest to newest, the
  // "history before this session" grows.
  const historyBefore = new Map<string, SetRow[]>(); // sessionId → prior sets
  const accumulatedSets: SetRow[] = [];
  for (const [sessionId] of sessionsByDate) {
    historyBefore.set(sessionId, [...accumulatedSets]);
    const group = bySession.get(sessionId)!;
    accumulatedSets.push(...group.sets);
  }

  // Build result
  return sortedSessions.map(([sessionId, group]) => {
    const priorSets = historyBefore.get(sessionId) ?? [];

    const historySets: HistorySet[] = group.sets.map((set) => {
      const { is1RM, isRepPR } = detectPR(set, priorSets);
      return { set, isPR: is1RM || isRepPR };
    });

    return {
      sessionId,
      startedAt: group.startedAt,
      sets: historySets,
    };
  });
}

// ---------------------------------------------------------------------------
// Best estimated 1RM helper
// ---------------------------------------------------------------------------

/**
 * Compute the best estimated 1RM across a flat array of working sets.
 * Returns null if no valid sets.
 */
export function bestEstimated1RM(sets: SetRow[]): number | null {
  let best = 0;
  for (const s of sets) {
    if (s.weight_kg == null || s.reps == null || s.reps < 1) continue;
    const e = estimated1RM(s.weight_kg, s.reps);
    if (e > best) best = e;
  }
  return best > 0 ? best : null;
}
