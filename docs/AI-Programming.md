# AI Programming — data strategy

> **Later phase**, not MVP. But the data model is designed **now** so the LLM can consume the records without forcing a big migration. This note defines what signals we capture and why.

## LLM goal
Given the fixed **hypertrophy** goal, recommend programming (which exercises, how much weight, how many reps, how many sets, what RIR) with as much certainty as possible based on the user's real progress.

## What hypertrophy optimizes (so, what the LLM looks at)
1. **Effective volume per muscle group / week** — the main metric. Computed by summing each set's `contribution` via `exercise_muscles` (fractional volume: primary 1.0, secondary 0.5).
2. **Proximity to failure** — sets at ~0–3 RIR. Captured per set (`rir`/`rpe`).
3. **Progressive overload** — weight×reps trend per exercise over time. Captured set by set with timestamps.
4. **Per-muscle frequency** — how many times/week each group is trained. Derivable from sessions + `exercise_muscles`.
5. **Fatigue management / deload** — detect stalls or performance regression. Derivable from trends (no extra data asked of the user; for now **no** manual recovery signal).

## Signals we already capture (and where)
| Signal | Source in the model |
|---|---|
| Per-muscle volume | `sets` × `exercise_muscles.contribution` |
| Proximity to failure | `sets.rir` / `sets.rpe` |
| Progression | `sets` history (weight/reps/date) per exercise |
| Frequency | `workout_sessions` + exercises + `exercise_muscles` |
| Time per exercise and session | `session_exercises.started_at/ended_at`, `workout_sessions` |
| Estimated 1RM / PRs (signal) | derived from `sets` (Epley/Brzycki) |
| User context | `profiles`: level, days, equipment, priorities, limitations |

## User context (profile, captured once)
- Experience level (beginner/intermediate/advanced).
- Available days per week.
- Available equipment.
- Priority muscles and injuries / exercises to avoid.

## How the recommendation will flow (future)
- The LLM reads the history + context → writes prescriptions into the `target_*` of `routine_exercises` (sets, rep range or fixed number, weight, RIR).
- Future `recommendations` table to store what data it used and its reasoning (traceability).
- It may occasionally suggest "match/beat your rep-PR" — but the focus is volume + progression, not 1RM.

## Principle
> Don't build the LLM logic now. Do leave the model **one step away** from supporting it, so when the phase arrives we only add logic, not redo the schema.
