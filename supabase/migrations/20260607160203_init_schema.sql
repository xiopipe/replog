-- ============================================================
-- RepLog — Initial schema (Supabase / Postgres)
-- Goal: hypertrophy. Offline-first with Legend-State + Supabase sync.
-- Conventions:
--   * uuid PKs (client can generate them offline).
--   * created_at / updated_at on every table; deleted_at for soft delete.
--   * user_id denormalized on child tables (simple RLS + Legend-State per-user sync).
-- Apply in: Supabase > SQL Editor (paste and Run). Then run 02_seed_exercises.sql.
-- ============================================================

create extension if not exists pgcrypto;

-- ===================== ENUMS =====================
create type unit_enum            as enum ('kg','lb');
create type failure_metric_enum  as enum ('rir','rpe','none');
create type experience_enum      as enum ('beginner','intermediate','advanced');
create type equipment_enum       as enum ('barbell','dumbbell','machine','cable','bodyweight','other');
create type muscle_enum          as enum ('chest','back','shoulders','arms','quads','hamstrings_glutes','calves','core');
create type muscle_role_enum     as enum ('primary','secondary');
create type session_status_enum  as enum ('in_progress','completed');

-- ===================== updated_at trigger =====================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ===================== PROFILES =====================
create table profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  display_name             text,
  unit_preference          unit_enum           not null default 'kg',
  default_failure_metric   failure_metric_enum not null default 'rir',
  -- optional context for the LLM (filled from Settings)
  experience_level         experience_enum,
  available_days_per_week  int check (available_days_per_week between 1 and 7),
  preferred_weekdays       int[],
  equipment                text[],
  priority_muscles         muscle_enum[],
  limitations              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile on signup
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ===================== EXERCISES =====================
create table exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,  -- null = global predefined
  name          text not null,
  category      equipment_enum not null default 'other',
  is_custom     boolean not null default false,
  is_bodyweight boolean not null default false,  -- weight = added load
  instructions  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create trigger trg_exercises_updated before update on exercises
  for each row execute function set_updated_at();

create table exercise_muscles (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null references exercises(id) on delete cascade,
  muscle       muscle_enum not null,
  role         muscle_role_enum not null,
  contribution numeric not null default 1.0,  -- 1.0 primary, 0.5 secondary (editable)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (exercise_id, muscle)
);
create trigger trg_exmus_updated before update on exercise_muscles
  for each row execute function set_updated_at();

-- ===================== ROUTINES =====================
create table routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create trigger trg_routines_updated before update on routines
  for each row execute function set_updated_at();

create table routine_exercises (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  routine_id       uuid not null references routines(id) on delete cascade,
  exercise_id      uuid not null references exercises(id),
  order_index      int not null default 0,
  -- optional targets (filled by the user or, in the future, the LLM)
  target_sets      int,
  target_reps_min  int,
  target_reps_max  int,
  target_weight_kg numeric,
  target_rir       int,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create trigger trg_routine_ex_updated before update on routine_exercises
  for each row execute function set_updated_at();

-- ===================== PLANS (weekly split) =====================
create table plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create trigger trg_plans_updated before update on plans
  for each row execute function set_updated_at();

create table plan_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  plan_id     uuid not null references plans(id) on delete cascade,
  routine_id  uuid not null references routines(id),
  order_index int not null default 0,
  weekday     int check (weekday between 0 and 6),  -- null = flexible day; 0..6 = fixed day (0=Monday)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create trigger trg_plan_days_updated before update on plan_days
  for each row execute function set_updated_at();

-- ===================== WORKOUT SESSIONS =====================
create table workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  routine_id  uuid references routines(id),           -- null if started without a routine
  name        text,
  started_at  timestamptz not null default now(),     -- editable (retroactive logging)
  ended_at    timestamptz,
  status      session_status_enum not null default 'in_progress',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create trigger trg_sessions_updated before update on workout_sessions
  for each row execute function set_updated_at();

create table session_exercises (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  session_id      uuid not null references workout_sessions(id) on delete cascade,
  exercise_id     uuid not null references exercises(id),
  order_index     int not null default 0,
  -- automatic per-exercise timing
  started_at      timestamptz,
  ended_at        timestamptz,
  -- superset/circuit grouping (same group = performed together)
  superset_group  uuid,
  superset_order  int,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create trigger trg_sess_ex_updated before update on session_exercises
  for each row execute function set_updated_at();

create table sets (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  session_exercise_id  uuid not null references session_exercises(id) on delete cascade,
  set_index            int not null default 0,
  -- weight: dual storage (what was typed + normalized)
  weight_value         numeric,
  weight_unit          unit_enum,
  weight_kg            numeric,
  reps                 int,
  -- proximity to failure
  failure_metric       failure_metric_enum not null default 'none',
  rir                  int,
  rpe                  numeric,
  is_warmup            boolean not null default false,
  reached_failure      boolean not null default false,
  rest_seconds         int,
  -- dropset grouping (same group = chained drops)
  drop_group           uuid,
  drop_order           int,
  performed_at         timestamptz not null default now(),
  metadata             jsonb not null default '{}'::jsonb,  -- extensible without migration
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
create trigger trg_sets_updated before update on sets
  for each row execute function set_updated_at();

-- ===================== INDEXES =====================
create index idx_exercises_user        on exercises(user_id);
create index idx_exmus_exercise        on exercise_muscles(exercise_id);
create index idx_exmus_muscle          on exercise_muscles(muscle);
create index idx_routines_user         on routines(user_id);
create index idx_routine_ex_routine    on routine_exercises(routine_id);
create index idx_routine_ex_exercise   on routine_exercises(exercise_id);
create index idx_plans_user            on plans(user_id);
create index idx_plan_days_plan        on plan_days(plan_id);
create index idx_sessions_user_started on workout_sessions(user_id, started_at desc);
create index idx_sess_ex_session       on session_exercises(session_id);
create index idx_sess_ex_exercise      on session_exercises(exercise_id);
create index idx_sets_session_exercise on sets(session_exercise_id);
create index idx_sets_user             on sets(user_id);

-- ===================== ROW LEVEL SECURITY =====================
alter table profiles          enable row level security;
alter table exercises         enable row level security;
alter table exercise_muscles  enable row level security;
alter table routines          enable row level security;
alter table routine_exercises enable row level security;
alter table plans             enable row level security;
alter table plan_days         enable row level security;
alter table workout_sessions  enable row level security;
alter table session_exercises enable row level security;
alter table sets              enable row level security;

-- profiles: only your own
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- exercises: read globals (user_id null) and your own; write only your own
create policy exercises_read on exercises
  for select using (user_id is null or user_id = auth.uid());
create policy exercises_write on exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- exercise_muscles: visible if the exercise is global or yours; writable if the exercise is yours
create policy exmus_read on exercise_muscles
  for select using (exists (
    select 1 from exercises e
    where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid())));
create policy exmus_write on exercise_muscles
  for all using (exists (
    select 1 from exercises e where e.id = exercise_id and e.user_id = auth.uid()))
  with check (exists (
    select 1 from exercises e where e.id = exercise_id and e.user_id = auth.uid()));

-- tables with user_id: only your own (one "for all" policy per table)
create policy routines_own    on routines          for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy routine_ex_own  on routine_exercises for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plans_own       on plans             for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plan_days_own   on plan_days         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sessions_own    on workout_sessions  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy session_ex_own  on session_exercises for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sets_own        on sets              for all using (user_id = auth.uid()) with check (user_id = auth.uid());
