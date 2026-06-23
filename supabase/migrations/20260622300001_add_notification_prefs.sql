-- TKT-0062: Add notification_prefs JSONB column to profiles.
-- Additive migration — no RLS change needed (profiles already scoped by auth.uid()).
-- Shape (enforced by the app layer):
--   {
--     "enabled": false,
--     "workoutReminders": { "enabled": true, "time": "18:00" },
--     "inactivity": { "enabled": true },
--     "prCelebration": { "enabled": true }
--   }

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{}'::jsonb;
