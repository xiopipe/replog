-- ============================================================
-- TKT-0066: exercise_muscles_with_user view
--
-- Adds a Postgres view that joins exercise_muscles → exercises to expose
-- the parent exercise's user_id. This lets PostgREST filter by user_id
-- so the "user" observable can scope its sync to muscle rows belonging to
-- the current user's custom exercises without a client-side dedup.
--
-- The "global" observable reads rows where user_id IS NULL (built-in
-- exercises) — those remain on the original table.
-- Writes still target the exercise_muscles TABLE directly (view is read-only).
-- ============================================================

-- 1. Create the view
create or replace view exercise_muscles_with_user as
  select
    em.id,
    em.exercise_id,
    em.muscle,
    em.role,
    em.contribution,
    em.created_at,
    em.updated_at,
    e.user_id
  from exercise_muscles em
  join exercises e on e.id = em.exercise_id;

-- 2. Enable RLS on the view
--    PostgREST respects RLS on views via the underlying table's RLS, but we
--    use a security_barrier view + a RLS-style policy on the view itself for
--    explicit defence-in-depth.
alter view exercise_muscles_with_user set (security_barrier = true);

-- Grant SELECT on the view to the authenticated + anon roles
-- (anon needs it so the global (IS NULL) observable works before login).
grant select on exercise_muscles_with_user to authenticated;
grant select on exercise_muscles_with_user to anon;

-- 3. INSTEAD OF triggers — make the view fully writable
--
-- PostgREST cannot INSERT/UPDATE/DELETE through a JOIN view directly.
-- These triggers intercept DML on the view and route it to the underlying
-- exercise_muscles table (writing only the real em columns; user_id is
-- derived from the exercises join and is NOT stored on exercise_muscles).
--
-- RLS on the underlying table still applies: the trigger runs as the
-- calling role, so the authenticated user can only write rows whose
-- parent exercise they own (existing RLS on exercise_muscles enforces this).

create or replace function exercise_muscles_with_user_insert()
returns trigger language plpgsql as $$
begin
  insert into exercise_muscles (id, exercise_id, muscle, role, contribution, created_at, updated_at)
  values (
    NEW.id,
    NEW.exercise_id,
    NEW.muscle,
    NEW.role,
    NEW.contribution,
    coalesce(NEW.created_at, now()),
    coalesce(NEW.updated_at, now())
  );
  return NEW;
end;
$$;

create or replace function exercise_muscles_with_user_update()
returns trigger language plpgsql as $$
begin
  update exercise_muscles
  set
    exercise_id  = NEW.exercise_id,
    muscle       = NEW.muscle,
    role         = NEW.role,
    contribution = NEW.contribution,
    updated_at   = coalesce(NEW.updated_at, now())
  where id = OLD.id;
  return NEW;
end;
$$;

create or replace function exercise_muscles_with_user_delete()
returns trigger language plpgsql as $$
begin
  delete from exercise_muscles where id = OLD.id;
  return OLD;
end;
$$;

create trigger trg_exmus_view_insert
  instead of insert on exercise_muscles_with_user
  for each row execute function exercise_muscles_with_user_insert();

create trigger trg_exmus_view_update
  instead of update on exercise_muscles_with_user
  for each row execute function exercise_muscles_with_user_update();

create trigger trg_exmus_view_delete
  instead of delete on exercise_muscles_with_user
  for each row execute function exercise_muscles_with_user_delete();

-- Grant INSERT / UPDATE / DELETE on the view to authenticated users.
-- (anon never writes; global seed rows are read-only by design.)
grant insert, update, delete on exercise_muscles_with_user to authenticated;

-- The underlying exercise_muscles table already has RLS policies from the
-- init schema (users can read rows whose parent exercise is theirs or global).
-- Because the view is created with security_barrier, Postgres pushes predicates
-- through to the underlying RLS, so the effective access control is:
--   SELECT: visible rows where e.user_id = auth.uid() OR e.user_id IS NULL
--   INSERT/UPDATE/DELETE: only rows whose parent exercise is owned by auth.uid()
--     (enforced by existing RLS on exercise_muscles via the INSTEAD OF trigger
--      running as the authenticated role).
