-- TKT-0043: Add onboarding_complete flag to profiles.
-- When NULL (existing rows) or FALSE the onboarding prompt may be shown.
-- Set to TRUE once the user confirms their choices (or skips and is given
-- another chance via the Settings nudge later).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;
