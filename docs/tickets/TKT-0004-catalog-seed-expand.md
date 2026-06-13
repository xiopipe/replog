---
id: TKT-0004
title: Expand exercise catalog seed (~36 to ~60)
status: todo
phase: 5
labels: [data, catalog, content]
depends_on: []
spec_refs: ["../specs/Exercise-Catalog.md", "../specs/sql/02_seed_exercises.sql"]
created: 2026-06-13
---

## Context

The seeded catalog has ~36 exercises; the target is a curated ~60 covering all 8 muscle groups well. Each exercise needs correct `exercise_muscles` mappings (primary/secondary, contributions) so fractional volume and the muscle figure are accurate.

## Acceptance criteria (EARS)

- WHEN the seed is applied THE SYSTEM SHALL contain ~60 global exercises spanning all 8 muscle groups.
- WHEN any seeded exercise is opened THE SYSTEM SHALL show correct primary/secondary muscle highlighting from `exercise_muscles`.
- WHEN a seeded exercise is bodyweight THE SYSTEM SHALL set `is_bodyweight = true` and label the weight field as added load.
- All seed content is in English; no duplicate exercises.

## Implementation notes

- Extend `docs/specs/sql/02_seed_exercises.sql`.
- Follow the taxonomy in `docs/specs/Exercise-Catalog.md` (8 groups).
- Keep `category` values within the allowed enum.

## Out of scope

- User-custom exercises (already implemented).
- External exercise media/images (muscle figure only).
