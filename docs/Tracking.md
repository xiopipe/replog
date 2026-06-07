# Tracking workouts

> Main MVP feature.

## Goal
Make logging each set during training **fast and gym-proof** (offline, few taps, big numbers).

## Main flow (happy path) — focused walkthrough
A workout is a **walkthrough of the exercises planned for that day**, not a list you keep adding to. One exercise on screen at a time (like a slide).

1. **Start the day's workout**: the planned routine's exercise sequence loads (e.g., "Monday · Chest"). You can also start without a plan.
2. **Exercise in focus**: the screen shows the current exercise and its progress ("Exercise 2 of 5"), with its own timer.
3. **Log sets** for the exercise: weight, reps, and (optional) RIR/RPE → rows in `sets`. Add set / duplicate the previous one.
4. **"Next exercise"**: moving on **closes the current exercise and saves its duration** (start → moment of advancing) and advances to the next (slide). You can also swipe between exercises.
5. **Secondary actions** (⋮ menu): add/swap/skip an exercise on the fly. Not the primary action.
6. **Finish workout** → `status = completed`, sets `ended_at`.
7. Everything works **offline**; syncs on reconnect.

### Data philosophy: measure a lot, type little
Capture the **maximum number of signals automatically** with minimum user effort. Times (session, per exercise, each set's timestamp) are measured automatically; the user only types weight/reps/RIR.

## What is captured per set
| Field | Type | Notes |
|---|---|---|
| Weight | number | In the user's unit (kg/lb); stored canonically in kg. |
| Reps | integer | Reps performed. |
| Proximity to failure | RIR or RPE | **Configurable**: the user chooses the metric (or none). RIR 0 = failure; RPE 1–10. |
| Warm-up | flag | Distinguishes warm-up sets from working sets. |
| Reached failure? | flag | Optional. |
| Rest | seconds | Optional. |
| Notes | text | Optional. |

## Relevant design decisions
- **Configurable RIR/RPE**: defaults to the profile metric (`default_failure_metric`); can be changed per set. Show an indicative conversion (RPE 8 ≈ 2 RIR).
- **Flexible session (hybrid)**: even when starting from a template, you can add/remove/reorder exercises in the moment (e.g., machine occupied). The MVP does **not** track "planned vs done" (free add/remove was chosen).
- **Templates — minimal version in MVP**: no dedicated routine editor during a session. Instead: **"repeat last workout"** and **"duplicate a previous session"** as an informal template. The full routine editor is a later phase.
- **Retroactive logging**: you can create a workout with a **past date** and **edit saved sets** (fix mistakes or omissions). `started_at` editable.
- **Bodyweight + added load**: for `is_bodyweight` exercises (pull-ups, dips) log **reps + added load** as "the weight" (bodyweight is not added); 0 = no load.
- **Smart prefill** (MVP nice-to-have): when adding an exercise, suggest the weight/reps from last time (reads history; not "automatic progression").
- **Fast entry**: numeric keypad, +/- buttons for weight and reps, duplicate the previous set in one tap.
- **No rest timer in the MVP**: `rest_seconds` exists (optional manual entry), but a timer with alert is a later phase.
- **PR detection in the moment**: on saving a set, compare with the exercise's local history; if it's a record (more weight, more reps, or better estimated 1RM), show a celebration. Cheap computation over local SQLite.
  - **Hypertrophy framing**: no real 1RM testing. PRs are **rep / estimated-1RM** based and stored as a progress *signal*, not a goal. The LLM (future) may occasionally suggest beating a rep-PR, but the focus is volume + progressive overload.

### Precise PR definition (to implement unambiguously)
Per exercise, a working set triggers a PR if it meets **either**:
- **Estimated-1RM PR**: its estimated 1RM (Epley/Brzycki from weight×reps) beats the previous best estimated 1RM for the exercise.
- **Rep-PR**: more reps at a weight **equal or greater** than the previous max at that rep count.

Rules: **warm-ups (`is_warmup`) never count** — not for PRs or volume. Computed over local history (SQLite), cheap and instant.

## History
- Per exercise: list of past sessions with their sets (weight × reps @ RIR/RPE).
- Per session: view a completed workout.
- No charts in the MVP (that's phase 2), but the data is ready for it.

## Screens (first sketch)
- **Home**: start workout, view in-progress session.
- **Active session**: list of exercises + sets, "add exercise", "add set".
- **Exercise picker**: search catalog, filter by group, create custom.
- **Exercise detail / history**.
- **Settings**: unit (kg/lb), default failure metric, account.

## Edge cases to consider
- Closing the app mid-session → the `in_progress` session is recovered.
- Edit/delete an already-logged set (soft delete).
- Same user on two devices → sync with last-write-wins.
- Exercise with no weight (bodyweight) → `weight_kg = 0` or added load.

## Out of scope (MVP)
Charts, automatic programming, AI suggestions, sharing/social feed, supersets/dropsets as a first-class entity beyond grouping (notes/metadata for edge details).
