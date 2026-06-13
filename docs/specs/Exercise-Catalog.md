# Exercise catalog

> Status: **draft**. Defines the catalog source and the muscle-group taxonomy (fixed vocabulary from day 1).

## Source
- **Curated list** of ~36–60 common strength exercises, well tagged.
- The user can **create custom exercises** (stored with their `user_id`).
- Predefined ones are global (`user_id = null`), read-only.

## Muscle-group taxonomy (fixed enum)
**Simple** level, 8 groups. Each exercise has one `primary` muscle and optionally `secondary` muscles.

1. `chest`
2. `back`
3. `shoulders`
4. `arms` (biceps + triceps; combined at the simple level)
5. `quads`
6. `hamstrings_glutes`
7. `calves`
8. `core`

> If we later want per-muscle detail, a second level can be added without breaking this (the 8 groups remain the "big group").

## Equipment category (enum)
`barbell` · `dumbbell` · `machine` · `cable` · `bodyweight` · `other`

## Visual representation and instruction
- **Muscle figure**: each exercise shows a front/back figure highlighting the worked muscles, **generated from `exercise_muscles`** (primary more intense, secondary fainter). No images stored; consistent style. The same figure is reused for a future weekly volume map.
- **Short instruction**: `instructions` field with 1–2 sentences on how to do it.
- → Curating the catalog includes: name, equipment, muscle mapping (primary + secondary), and a short instruction.

## Seed
See `sql/02_seed_exercises.sql` for the ~36 seeded global exercises with their muscle mappings. Pending: extend to ~60 and review per-exercise instructions.
