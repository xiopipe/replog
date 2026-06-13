---
id: TKT-0005
title: Superset/dropset visual grouping polish
status: todo
phase: 5
labels: [ui, session]
depends_on: []
spec_refs: ["../specs/Architecture.md", "../specs/Tracking.md", "../specs/Design-UX.md"]
created: 2026-06-13
---

## Context

The data model and mutations for supersets (`superset_group`/`superset_order` on `session_exercises`) and dropsets (`drop_group`/`drop_order` on `sets`) exist, but the in-session UI does not yet make the grouping visually clear. Design-UX flags this as a pending item ("how supersets/dropsets are grouped visually without cluttering the row").

## Acceptance criteria (EARS)

- WHEN two or more exercises share a `superset_group` THE SYSTEM SHALL visually group them in the session UI (clear, low-clutter grouping).
- WHEN sets share a `drop_group` THE SYSTEM SHALL visually chain them as a dropset within the exercise.
- WHEN exercises/sets are ungrouped (`null`) THE SYSTEM SHALL render them as normal, unchanged.
- All labels come from i18n (`es.json`).

## Implementation notes

- Touch points: `src/features/session/SetRow.tsx`, `src/features/session/ExercisePager.tsx`, session summary.
- Keep readability at arm's length (large numbers, ample touch targets) per the constitution.

## Out of scope

- Changing the grouping data model (group keys stay as-is).
