# Vision

**App name: RepLog.**

## The problem
Seriously tracking a strength workout — weight, reps, and above all **how close to failure** each set was — is tedious with paper notes or generic apps. Without that data you can't see real progression or, later, let an AI help with programming.

## The proposal
A **simple but complete** mobile app to log workouts set by set: which exercise, what weight, how many reps, and how close to failure (RIR/RPE). The focus is on making logging fast during training and keeping the data well structured for week-over-week analysis.

## Training goal (fixed)
The app is designed for **hypertrophy (muscle gain)**. It is **not** powerlifting or weightlifting, and that will not change. Design consequences: what matters is **effective volume per muscle group/week**, sets taken **close to failure** (~0–3 RIR), and **progressive overload** — not max 1RM. No real 1RM testing; estimated 1RM and rep-PRs are stored only as progress signals.

## Target user
People who train strength in the gym (free weights, machines) **with a hypertrophy goal** and want rigorous progress tracking. Multi-user from the start: each person owns their data.

## Guiding principle
> Logging is trivial today; the **data model** is designed to scale tomorrow to advanced programming, AI recommendations, and nutrition — without rewriting anything.

## Goals (what it IS)
- Fast per-set logging: weight, reps, RIR/RPE (configurable).
- Flexible sessions: add/remove exercises on the fly.
- Predefined + custom exercise catalog.
- Multi-user with isolated data.
- **Offline-first** (key: the gym may have no network).
- Simple per-exercise history.
- Configurable kg/lb units.

## Non-goals (NOT in the MVP)
- Advanced charts/analytics (estimated 1RM, volume, PRs, adherence) → phase 2.
- Automatic programming/periodization → future.
- AI recommendations → future (but the model supports it).
- Nutrition logging → future (but the model anticipates it).
- Social feed / sharing workouts → future.
- iOS → Android first.

## MVP success metric
Complete and log a full real workout from the phone, offline, in fewer taps than a notebook — and retrieve each exercise's history.
