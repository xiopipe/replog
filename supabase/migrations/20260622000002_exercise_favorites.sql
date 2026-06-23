-- ============================================================
-- RepLog — exercise_favorites table (TKT-0039)
-- User-scoped favorites for the exercise catalog.
-- Conventions: uuid PK, user_id denormalized, created_at only
-- (no updated_at — favorites are toggled in/out, not updated).
-- No deleted_at: hard-delete on un-favorite is safe (no FK children).
-- ============================================================

create table if not exists exercise_favorites (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  exercise_id  uuid not null references exercises(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create index if not exists idx_exfav_user     on exercise_favorites(user_id);
create index if not exists idx_exfav_exercise on exercise_favorites(exercise_id);

alter table exercise_favorites enable row level security;

-- Only the owning user can read or write their favorites.
create policy exfav_own on exercise_favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
