-- TKT-0016: Add global weight increment preference to profiles.
-- Default 2.5 matches the historical hard-coded stepper increment.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS weight_increment numeric DEFAULT 2.5;
