/**
 * useActiveSessionTimer — drives the live session timer and persists real
 * active time across AppState transitions (TKT-0011).
 *
 * See `activeTime.ts` for the model and the pure helpers used here.
 *
 *   - App → background: commit the current segment (accumulated += elapsed),
 *     persist, and stop the segment. Background time is never added.
 *   - App → foreground: start a fresh segment from now.
 *   - Finish / unmount: commit the final segment.
 *   - Crash mid-session: on relaunch we read the last persisted accumulated
 *     value and start a fresh segment — the crashed-away interval is excluded.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { UserObservables } from '@/db';
import { addActiveTime } from './mutations';
import { liveActiveSeconds } from './activeTime';

export interface UseActiveSessionTimerArgs {
  db: UserObservables | null | undefined;
  sessionId: string | null | undefined;
  /** Committed accumulated seconds from the session row (reactive). */
  accumulatedSeconds: number;
  /** Whether the session is currently active (status 'in_progress'). */
  isActive: boolean;
}

export interface UseActiveSessionTimer {
  /** Seconds to render in the timer. */
  displaySeconds: number;
  /** Commit the in-flight segment immediately (call before finishing). */
  commitNow: () => void;
}

export function useActiveSessionTimer({
  db,
  sessionId,
  accumulatedSeconds,
  isActive,
}: UseActiveSessionTimerArgs): UseActiveSessionTimer {
  // committedRef mirrors the persisted accumulator; segmentStartRef marks the
  // current foreground segment. Refs (not state) so AppState/interval callbacks
  // always read live values without re-subscribing.
  const committedRef = useRef(Math.max(0, Math.floor(accumulatedSeconds || 0)));
  const segmentStartRef = useRef<number | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(() =>
    Math.max(0, Math.floor(accumulatedSeconds || 0)),
  );

  // Mutable refs for db/sessionId so commitNow keeps a stable identity — the
  // main effect (interval + AppState listener) then never tears down/restarts
  // when the db observable's object identity changes (e.g. auth init).
  const dbRef = useRef(db);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    dbRef.current = db;
    sessionIdRef.current = sessionId;
  });

  // Keep committedRef in sync if the row's accumulator changes from elsewhere
  // (e.g. the stale-modal "finish with real duration" override) while no
  // segment is running.
  useEffect(() => {
    if (segmentStartRef.current == null) {
      committedRef.current = Math.max(0, Math.floor(accumulatedSeconds || 0));
      setDisplaySeconds(committedRef.current);
    }
  }, [accumulatedSeconds]);

  // Commit the current segment to committedRef + persist, then stop it.
  const commitNow = useCallback(() => {
    const start = segmentStartRef.current;
    if (start == null) return;
    const delta = Math.max(0, Math.floor((Date.now() - start) / 1000));
    segmentStartRef.current = null;
    if (delta > 0) {
      committedRef.current += delta;
      if (dbRef.current && sessionIdRef.current) {
        addActiveTime(dbRef.current, sessionIdRef.current, delta);
      }
    }
  }, []);

  useEffect(() => {
    if (!isActive || !sessionId) {
      // Paused/completed: ensure no segment keeps running.
      segmentStartRef.current = null;
      setDisplaySeconds(committedRef.current);
      return;
    }

    // Start a fresh segment from now (crash-safe: crashed time is excluded).
    segmentStartRef.current = Date.now();
    setDisplaySeconds(liveActiveSeconds(committedRef.current, segmentStartRef.current, Date.now()));

    const interval = setInterval(() => {
      setDisplaySeconds(
        liveActiveSeconds(committedRef.current, segmentStartRef.current, Date.now()),
      );
    }, 1000);

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        // Resume: start a new segment.
        if (segmentStartRef.current == null) segmentStartRef.current = Date.now();
        setDisplaySeconds(
          liveActiveSeconds(committedRef.current, segmentStartRef.current, Date.now()),
        );
      } else {
        // background | inactive: pause and commit elapsed active time.
        commitNow();
        setDisplaySeconds(committedRef.current);
      }
    };

    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      clearInterval(interval);
      sub.remove();
      // Commit whatever ran in this foreground segment before tearing down.
      commitNow();
    };
  }, [isActive, sessionId, commitNow]);

  return { displaySeconds, commitNow };
}
