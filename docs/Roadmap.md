# Roadmap

> Indicative phases. Order and scope adjust with discussion.

## Phase 0 — Technical foundations
- Expo + TypeScript project running on Android.
- Supabase: project, initial schema, RLS, auth (email/password + Google).
- Offline-first layer: Legend-State + Supabase sync plugin + local persistence.

## Phase 1 — MVP: plan and log workouts
- Exercise catalog (predefined + create custom).
- **Planning**: create day routines (exercise sequence) and organize them into a weekly plan (flexible or fixed days).
- **Focused session**: walk through the day's exercises one by one with "Next exercise"; automatic per-exercise and session timing.
- Log sets: weight, reps, configurable RIR/RPE, flags. Supersets/dropsets.
- Modify the session in the moment (add/swap/skip via ⋮).
- PR detection in the moment.
- Starter templates (splits) clonable + create plan from scratch.
- Session summary on finishing (duration, sets, sets per muscle, PRs).
- Minimal onboarding; optional profile context from Settings.
- Simple per-exercise and per-session history; retroactive logging.
- Settings: kg/lb unit, default failure metric.
- Works offline and syncs (Legend-State + Supabase).

## Phase 2 — Analytics
- Per-exercise progression (charts).
- Volume / tonnage per session, week, and muscle group.
- Estimated 1RM and PRs.
- Adherence / calendar / streaks.

## Phase 3 — Advanced programming
- Progression suggestions (linear, double progression) based on history.
- Periodization / blocks / deloads / %1RM (entities `programs`, `mesocycles`).
- (Basic routine and weekly-plan planning is already in the MVP.)

## Phase 4 — Intelligence
- AI that consumes the history (RIR/RPE, weight, reps, rests) to suggest programming.
- Nutrition integration as an extra signal.

## Phase 5 — Extras
- Nutrition and body-metrics logging.
- Social feed / sharing workouts.
- iOS.
