# Known Issues

Log of defects found while running the app, with root cause, fix, and verification.
Newest first. IDs are stable (`KI-NNN`) so other docs and commits can reference them.

Status legend: 🟥 open · 🟩 fixed · 🟨 mitigated/won't-fix · 🔍 reported (needs repro)

Verification legend: ✅ reproduced by me · 🔍 found in static review, not yet reproduced

---

## Exhaustive app sweep — 2026-06-13

Second pass: drove every screen on the Android emulator (auth, home, plan,
templates, session, catalog + exercise detail/muscle figure, history, settings) and
ran a full static code review. Findings below, newest first. The muscle figure was
investigated specifically (user suspected it was wrong) — conclusion in **KI-004**.

---

## KI-002 🟥 ✅ Catalog filter chips stretch to full height

**Found:** 2026-06-13, on the *Catálogo de ejercicios* screen, most visible while a
search is active or the result list is short.

**Symptom:** The muscle-group filter chips (Todos / Pecho / Espalda / …) render as
tall full-height **columns** instead of short pills. With a long list they look
normal; with a short list they blow up vertically. (Screenshots `/tmp/s7s.png`,
`/tmp/s8s.png` during the sweep.)

**Root cause:** `src/components/FilterChips.tsx` renders a **horizontal**
`<ScrollView>` with no height bound. Placed directly in the screen's flex column
(`app/catalog/index.tsx:178`), the ScrollView grabs the leftover vertical space, and
because `styles.row` (the `contentContainerStyle`) sets no `alignItems`, the chips —
which only set `minHeight: TOUCH_TARGET`, no max — **stretch to the ScrollView's full
height** (flex cross-axis default is `stretch`).

**Fix (proposed):** in `FilterChips.tsx`, add `style={{ flexGrow: 0 }}` to the
`ScrollView` so it hugs its content height, and `alignItems: 'center'` to the `row`
style so chips keep their intrinsic height. Both are needed (one stops the container
growing, the other stops the chips stretching). Benefits every `FilterChips` usage.

---

## KI-003 🟥 ✅ Old routines accumulate when the start template is changed

**Found:** 2026-06-13. Applied the *Full body 3 días* template, then used *Cambiar
plantilla de inicio* → *PPL*.

**Symptom:** The *Rutinas* list ended up with **9 routines** — the 3 old `Full body
A/B/C` plus PPL's 6 (`Push A/B`, `Pull A/B`, `Legs A/B`). Switching templates creates
the new routines but never removes the previous template's routines or their
`routine_exercises`; they pile up. (Screenshot `/tmp/s3s.png`.)

**Root cause:** `createPlanFromTemplate` (`src/features/routines/mutations.ts`)
deactivates the old plan and creates a fresh plan + routines, but does not soft-delete
the routines/plan_days from the plan being replaced.

**Needs product decision:** are routines a reusable library (keep them) or owned by the
plan (clean them up on replace)? If the latter, soft-delete the prior plan's routines +
plan_days in the same cascade. Documenting; not auto-fixed.

---

## KI-004 🟨 ✅ Muscle figure is correct, but highlights at muscle-GROUP granularity

**This is the muscle-image concern the user raised.** Investigated the figure end to
end (library, mapping, seed data) **and** verified it visually on three exercises.

**Verdict — the figure itself works:**
- Library `react-native-body-highlighter@3.2.0` is installed and used correctly
  (`src/features/catalog/MuscleFigure.tsx`, rendered at `app/catalog/[id].tsx`).
- All 8 RepLog groups map to valid library slugs; primary→intensity 2, secondary→1;
  front/back split correct; colors ordered right.
- Visual checks: *Ab wheel rollout* → abs lit on front only ✅; *Barbell row* → whole
  back bright (Principal: Espalda) + arms lighter (Secundario: Brazos) ✅; *Barbell
  curl* → arms lit ✅. (Screenshots `/tmp/s5s.png`, `/tmp/s9s.png`, `/tmp/s6s.png`.)

**What looks "wrong":** RepLog's taxonomy has a single **`arms` ("Brazos")** group, so
the figure cannot distinguish biceps from triceps — a **biceps curl lights up the
triceps and forearms too**, which reads as anatomically wrong. Same coarseness for
`back` (lats/traps/lower-back all light together) and `shoulders` (no posterior-delt on
the back view).

**Root cause:** the 8-group model in `docs/specs/Exercise-Catalog.md` +
`MUSCLE_TO_SLUGS` mapping one group → all member slugs. The component faithfully renders
whatever the group says.

**Options (product decision):**
1. Accept it — group-level highlighting is the documented MVP model. (Mitigated/won't-fix.)
2. Add a finer muscle field on `exercise_muscles` (e.g. distinguish biceps/triceps) and
   map that to slugs for display only, keeping the 8 groups for volume math.

Marked 🟨 pending that decision. Plus two seed-data accuracy gaps surfaced by the
review: heavy back lifts (barbell row, deadlift) don't list trapezius as a secondary
muscle in `docs/specs/sql/02_seed_exercises.sql`, so trap volume is undercounted.

---

## KI-005 🟥 ✅ RPE can be decremented to 0 (spec says RPE 1–10)

`src/features/session/SetRow.tsx:246-249` — the failure-metric stepper floors at
`Math.max(0, cur - 1)` for **both** RIR and RPE. RIR 0 is valid; **RPE 0 is not**
(Tracking.md: RPE 1–10). The increment cap is already metric-aware (10 for RPE, 5 for
RIR). **Fix:** floor at 1 when `effectiveMetric === 'rpe'`, else 0. Low risk.

---

## KI-006 🟥 ✅ Hardcoded `kg` in weight displays ignores lb users

PR/summary weight strings hardcode `kg` in the `weight_kg` fallback branch, so a user
whose unit is **lb** sees `kg`:
- `app/session/summary/[id].tsx:140` — `${set.weight_kg} kg`
- `app/session/[id].tsx:185` — `${updatedSet.weight_kg} kg`
- (`summary/[id].tsx:138` uses `weight_unit ?? 'kg'` — same fallback issue.)

Other screens (`catalog/[id].tsx`, `history/[id].tsx`) resolve the unit from the
profile correctly — **Fix:** do the same here (`userUnit`). Severity: correctness/i18n.

---

## KI-007 🟥 🔍 `SessionTimer` renders `NaN:NaN` on a malformed `started_at`

`src/features/session/SessionTimer.tsx:24-27` — `Date.now() - new Date(startedAt)
.getTime()` is unguarded; a non-parseable timestamp propagates `NaN` → `formatMmSs`
prints `"NaN:NaN"`. In practice `started_at` is always a fresh `toISOString()`, so this
only bites on corrupted/migrated data. **Fix:** `Number.isNaN(parsed) → return 0`.
Crash-hardening, low probability.

---

## KI-008 🟥 🔍 `MuscleFigure` unguarded group→slug lookup

`src/features/catalog/MuscleFigure.tsx:89` — `const slugs = MUSCLE_TO_SLUGS[muscle];
for (const slug of slugs)` throws if `muscle` is ever a value not in the map (new/bad
enum from data). **Fix:** `if (!slugs) continue;`. Low probability, cheap guard.

---

## KI-009 🟥 🔍 `softDelete` may resurrect rows (delete-after-set race)

`src/db/sync.ts` `softDelete` writes `{ deleted_at, updated_at }` and then calls
`entry$.delete()` **in the same tick**. The collections configure
`actions: ['read','create','update']` (no `delete`), so `.delete()` only drops the
local key — it does not issue a Postgres DELETE. Risk: if the local key is removed
before the debounced push flushes the `deleted_at` UPDATE, the row never gets stamped
in Postgres and **reappears** on the next full-list fetch (its `deleted_at` is still
null, so the `.is('deleted_at', null)` filter lets it back in). Timing-dependent;
**not yet reproduced**. Suggested repro: soft-delete a routine, force a full resync,
check if it returns. **Fix candidate:** don't `.delete()` the local key — rely on the
`deleted_at` filter to hide it — or delete only after the push confirms. Severity:
potential data-corruption.

---

## KI-010 🟥 🔍 Additional static-review findings (lower priority, not yet reproduced)

Found by code review during the sweep; each is plausible but unverified at runtime:

- **Text overflow** — user-entered names without `numberOfLines={1}` can overflow:
  `app/session/summary/[id].tsx:254` (PR exercise name), `app/plan/index.tsx:256-258`
  & routine-picker item, `app/routines/editor.tsx` target-editor title,
  `app/(tabs)/history.tsx:144`. Add `numberOfLines={1}` + `flexShrink`.
- **`PRBadge` safe-area** — absolutely positioned at `top:12` with no inset
  (`src/features/session/PRBadge.tsx:71-74`); can sit under the status bar / be clipped
  by an `overflow:'hidden'` ancestor.
- **Retroactive duration can go negative** — retro editing clamps `started_at` only to
  `now`, not to `ended_at`; if set after `ended_at`, `durationMs` < 0
  (`src/features/session/queries.ts`, history duration display). Clamp to ≥ 0.
- **`SetRow` stale local state** — input state is seeded once via `useState` and never
  re-syncs if the `set` prop changes while mounted (external edit/duplicate); a later ✓
  can overwrite fresh data (`SetRow.tsx:136-144`). Key the row by set id or sync via effect.
- **Comma-decimal parsing** — `parseFloat('2,5')` → `2` on Spanish keyboards
  (`SetRow.tsx`). Normalize `,`→`.` before parse.
- **`updateProfile` upsert collision** — builds a row with `created_at: now` (→ INSERT)
  when the trigger-created profile already exists in Postgres
  (`src/features/settings/profile.ts`); risk of unique-violation / overwriting the
  trigger's `display_name`. Gate behind profile-loaded or upsert-on-conflict.
- **`exercise_muscles` dual observable overlap** — global and per-user observables both
  sync the same table with no disjoint filter (`src/db/exercise_muscles.ts`), duplicating
  the cached row set across two SQLite namespaces.
- **Dangling `plan_day`** — a plan_day pointing at a soft-deleted routine renders as
  "Descanso" and is never cleaned (`src/features/routines/queries.ts`). Relates to KI-003.
- **Empty `Alert` body** — delete-set confirm passes an empty message string
  (`app/history/[id].tsx`), so the dialog has no localized body. Add a translated key.
- **a11y label bypasses i18n** — `PRBadge.tsx:54` concatenates the accessibility label
  with a hardcoded `×` and fixed word order outside `t()`.

**Possible spec mismatch (question, not a bug):** RIR input caps at 5
(`SetRow.tsx:243`) while CLAUDE.md emphasizes "RIR 0–3" for hypertrophy. Likely
intentional (allow 0–5 input); confirm against Tracking.md.

**False positives ruled out during review:** `SetRow` "weight_kg never written" (the
parent routes through `updateSet`/`toCanonicalKg`); `history.pr_count` "missing key"
(i18next resolves `_one`/`_other` plural suffixes).

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
*Design rules so offline works* in `docs/specs/Architecture.md`. Any new parent/child
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
