-- TKT-0011 — Fix session timer counting wall-clock time when backgrounded.
--
-- The session duration was derived from wall-clock time (ended_at - started_at),
-- so any time the app spent backgrounded (locked screen, other apps, overnight
-- suspend) was counted as active workout time. This corrupted every stored
-- duration (e.g. a 1-minute workout reading 95:32).
--
-- Fix: track the real active time as an accumulator that excludes backgrounded
-- intervals. The client pauses the accumulator on AppState 'background' and
-- resumes on 'active'. started_at is unchanged (it records WHEN the session
-- began, not HOW LONG it ran).
--
-- Existing rows default to 0; the summary falls back to the legacy
-- ended_at - started_at computation when accumulated_active_seconds is 0, so
-- historical sessions render exactly as before (no retroactive correction).

alter table workout_sessions
  add column accumulated_active_seconds integer not null default 0;

comment on column workout_sessions.accumulated_active_seconds is
  'Real active workout time in seconds, excluding backgrounded intervals (TKT-0011). Source of truth for session duration. 0 on legacy rows (summary falls back to ended_at - started_at).';
