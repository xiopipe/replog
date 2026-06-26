-- TKT-0002: Add source_template_id marker to routines.
--
-- A nullable UUID column that records which starter-template key produced
-- this routine via createPlanFromTemplate. Routines with a non-null value
-- are "template-cloned" and eligible for auto-soft-delete when the user
-- switches to a different starter template. Routines without the marker
-- (manually created, or pre-existing before this migration) are NEVER
-- auto-deleted — they remain visible in the user's library.
--
-- The column is additive (no default, nullable) — existing rows get NULL
-- automatically, which means they are treated as manually created (safe).

alter table routines
  add column if not exists source_template_id text;

comment on column routines.source_template_id is
  'Non-null when this routine was cloned from a starter template. '
  'Value is the opaque template key (string) used in createPlanFromTemplate. '
  'NULL = user-created or pre-migration row; never auto-deleted on template change.';
