---
id: TKT-0003
title: Add migrations for optional profiles fields
status: todo
phase: 5
labels: [data, schema, settings]
depends_on: []
spec_refs: ["../specs/Architecture.md", "../specs/sql/01_schema.sql"]
created: 2026-06-13
---

## Context

The optional profile-context fields (`experience_level`, `available_days_per_week`, `preferred_weekdays`, `equipment`, `priority_muscles`, `limitations`) exist in the Settings form and are wired to `updateProfile()`, but the database migrations only cover `unit_preference` and `default_failure_metric`. The schema must catch up so the data persists and syncs.

## Acceptance criteria (EARS)

- WHEN the migration is applied THE SYSTEM SHALL add the optional profile columns to `profiles` as specified in `docs/specs/Architecture.md` §profiles.
- WHEN a user edits an optional profile field in Settings THE SYSTEM SHALL persist it locally and sync it to Supabase.
- WHEN the migration runs on an existing database THE SYSTEM SHALL not lose or corrupt existing profile rows (nullable/defaulted columns).
- The DDL in `docs/specs/sql/01_schema.sql` and `docs/specs/Architecture.md` stay in sync with the migration.

## Implementation notes

- Add a new Supabase migration under `supabase/migrations/`.
- Mirror the column types in the Legend-State synced shape (`src/db/profiles.ts`).
- Keep RLS intact.

## Out of scope

- Any AI logic that consumes these fields (future phase).
