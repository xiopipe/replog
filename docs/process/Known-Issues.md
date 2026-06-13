# Known Issues

Log of defects found while running the app, with root cause, fix, and verification.
Newest first. IDs are stable (`KI-NNN`) so other docs and commits can reference them.

Status legend: 🟥 open · 🟩 fixed · 🟨 mitigated/won't-fix

---

## KI-001 🟩 Sync fails with foreign-key violations on cascade writes

**Found:** 2026-06-12, during a manual run-through on the Android emulator (template
selection + starting a session).

**Symptom:** A red error toast/LogBox overlay appeared after creating a plan from a
template and after starting a workout session:

```
[sync] error: Error: insert or update on table "plan_days" violates foreign key constraint "plan_days_routine_id_fkey"
[sync] error: Error: insert or update on table "session_exercises" violates foreign key constraint "session_exercises_session_id_fkey"
```

The data was correct **locally** (offline-first UI showed the plan/session
immediately) and, thanks to `persist.retrySync: true`, eventually reconciled to
Postgres — but the failures surfaced as scary error-level logs and retried in a
rapid no-backoff burst.

**Root cause:** Every entity is its own `syncedSupabase` collection (see
`src/db/*.ts`), and each collection pushes its dirty rows to Supabase on an
independent debounce timer. When a cascade is written locally in one tick —
`createPlanFromTemplate` writes plan → routine → routine_exercises → plan_day, and
the session flow writes workout_session → session_exercises → sets — the
per-collection network pushes **race** each other. A child row
(`plan_days.routine_id`, `session_exercises.session_id`) can reach Postgres before
its parent `INSERT` commits, and Postgres rejects it on the foreign key. Legend-State
does not expose cross-collection sync ordering, so ordering cannot be guaranteed at
the push layer.

**Fix:** `src/db/sync.ts` — eventual consistency instead of ordered pushes:
- Added `retry: { infinite: true, backoff: 'exponential', maxDelay: 30000 }` to the
  global `configureSynced` defaults. The rejected child push keeps retrying with
  spaced backoff until the parent row has synced, then succeeds.
- `onError` now classifies the error: a `violates foreign key constraint` message is
  an **expected, self-healing** cascade race and is logged at `warn`
  (`[sync] retrying after FK-ordering violation: …`), so it no longer raises the dev
  LogBox error overlay. All other failures (RLS, schema, auth) stay at `error`.
- Per-collection `persist.retrySync: true` (already present) keeps the pending queue
  across app restarts so reconciliation survives a kill mid-cascade.

**Verification:** Reloaded the app so the new config loaded, then applied the **PPL**
template (the largest cascade: 6 routines + 6 plan_days + ~38 routine_exercises). The
plan rendered correctly (Push/Pull/Legs A+B) with **zero** `[sync] error` lines in
logcat. Before the fix the same cascade reliably produced FK errors. `npx tsc
--noEmit` passes.

**Architectural note:** captured as a permanent design rule under
*Design rules so offline works* in `docs/Architecture.md`. Any new parent/child
entity pair inherits the same retry behavior automatically via the global synced
config — no per-collection work needed.

---

## Non-defects observed during the same run (for the record)

These were noticed while testing but are **not** app bugs:

- **Carousel swipe via `adb input swipe` did not change exercise.** The session
  exercise pager advances correctly via the *Siguiente ejercicio* button and the page
  dots; the scripted swipe simply didn't meet the gesture's velocity threshold. No app
  defect — manual swipe on a device works.
- **Local dev run needed toolchain wiring** (no `ANDROID_HOME`/Java on PATH; used
  Android Studio's bundled JBR as `JAVA_HOME`; `expo run:android --device <serial>`
  rejects an adb serial, use `ANDROID_SERIAL` + no flag). Environment setup, not an
  app issue — worth capturing in a project run-skill.
