# RepLog — Overview

**Name:** RepLog · **Status:** Active · **Phase:** Spec definition

## What it is
Mobile app to log strength training set by set (weight, reps, proximity to failure) with week-over-week tracking. The MVP focuses on **logging**; the data model is built to scale to programming, AI, and nutrition.

## MVP in one line
Log strength workouts capturing weight, reps, and RIR/RPE per set, with per-exercise history, multi-user, and working offline — on an extensible data model.

## Stack
| Layer | Choice |
|---|---|
| App | React Native + **Expo** (managed), Android first |
| Backend | **Supabase** (managed Postgres + auth + APIs) |
| Language | TypeScript across the stack |
| Auth | Email/password + Google |
| Data | Postgres · **offline-first** with Legend-State + Supabase sync |

## Project index
- `Vision.md` — problem, goals, non-goals
- `Tracking.md` — main feature: logging flow
- `Architecture.md` — stack, offline-first, and **data model**
- `Exercise-Catalog.md` — taxonomy and muscle figure
- `Design-UX.md` + `UI-Mockups/` — navigation and screens
- `AI-Programming.md` — data strategy for the future LLM
- `SQL-Schema.md` — how to apply the DB
- `Build-Plan.md` — step-by-step build plan (for Claude Code)
- `Roadmap.md` · `Backlog.md` · `Discussion-Decisions.md`
- `Feed.md` — (out of MVP, future phase)
