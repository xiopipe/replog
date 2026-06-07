# Design & UX

> Status: **draft to discuss**. Focus: log fast in the gym (offline, few taps, big readable numbers).

## Navigation — bottom tab bar (recommended)
Four fixed bottom tabs. Standard on Android, one tap away, discoverable. **Hidden during the active session** (focused mode).

1. **Home** — today's routine, start/resume workout, repeat last.
2. **Routines** — weekly plan, day routines (editor), and exercise catalog.
3. **History** — past workouts.
4. **Settings** — unit, failure metric, account.

## Onboarding — minimal
Sign up (email/password or Google) and **straight into the app**. Profile context (level, days, equipment, priorities, injuries) is **not required**: it's requested later from Settings. A non-intrusive nudge ("complete your profile for better recommendations") invites filling it in, with the future LLM in mind, without blocking the start.

## Screen map (MVP)
- **Login / Sign up** — email/password + Google button. Only the first time (session cached to enter offline afterward).
- **Home** — action-focused: weekly strip with today highlighted, **"Today's routine"** card (name, # exercises, estimated duration) with **"Start workout"**, **"Resume"** if there's an in-progress session, and a **"Repeat last workout"** shortcut. If there's no plan yet, it invites creating one (template or from scratch).
- **Active session** — focused walkthrough (see below). The heart of the app.
- **Session summary** — on finishing: duration, # sets/exercises, sets per muscle group, and PRs achieved. A closing and motivation moment.
- **Routines** — weekly plan (split) + routine list.
- **Routine editor** — name + reorderable list of exercises (drag), each with target sets×reps; **"+ Add exercise"**; save.
- **Weekly plan** — assign routines to days (fixed or flexible). Days with no routine = **implicit rest**. When creating the first plan: pick a **starter template** (Full body 3-day, Upper/Lower, PPL…) or **start blank**.
- **Exercise picker** — search, filter by muscle group (8 groups), create custom.
- **History** — past sessions grouped by week (day, name, duration, **sets per muscle group**, PR badge). Allows retroactive logging ("+" with a past date).
- **Session detail** — a full workout; editable.
- **Exercise detail / history** — past sets (weight × reps @ RIR/RPE), best mark.
- **Settings** — kg/lb unit, default failure metric, **optional profile context** (level, days, equipment, priorities, injuries), account / sign out.

## "Active session" screen — focused walkthrough (detail)
The most-used screen. **One exercise in focus at a time**, not a list. You advance to the next like a slide. The tab bar is hidden during the session (focused mode).

- Header: **day/routine** (e.g., "Monday · Chest") + total **session** timer.
- Subheader: progress **"Exercise 2 of 5"** + **⋮** menu (secondary actions).
- **Current exercise timer** (chip): automatically measures time spent on this exercise.
- Sets of the current exercise, each **set = inline editable row**: `[Weight] [Reps] [RIR/RPE] [✓]`.
  - Big numbers, numeric keypad, **+/-** buttons.
  - **Duplicate previous set** in one tap.
  - For `is_bodyweight` exercises, the weight column is labeled **"Added load"** and allows 0.
  - The failure metric defaults to the profile's; can be changed per set.
- Position indicator (dots) → move between exercises by swiping.
- **Primary button "Next exercise →"**: closes the exercise (saves its duration) and advances. **"Finish workout"** discreet below.
- **Secondary actions in ⋮**: add / swap / skip exercise (not the primary action).
- **Superset/dropset**: light visual grouping.
- **PR in the moment**: when checking ✓ a set that beats a record, micro-celebration.
- Everything saves instantly to local (offline).

## Visual principles
- Readable at arm's length: large typography, good contrast, ample touch targets.
- Minimal friction: log a set in 1–2 taps when values repeat.
- Clear states: in progress vs finished; saved local vs synced.
- Dark mode by default (gym).

## Mockups
The 7 MVP screens are in `UI-Mockups.md` (embedded SVG): home, active-session, routine-editor, history, weekly-plan, session-summary, and exercise-detail.

## Pending / to explore
- How supersets/dropsets are grouped visually without cluttering the row.
- Accessibility (sizes, contrast).
