-- ============================================================
-- RepLog — Fix handle_new_user trigger for anonymous Supabase users (TKT-0067)
--
-- Problem:
--   The original trigger used:
--     coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1))
--   When new.email IS NULL (anonymous users have no email address),
--   split_part(NULL,'@',1) returns '' (empty string) in Postgres, so the
--   coalesce resolves to '' — not NULL.  The app's null-safety check for
--   criterion 16 (show 'Usuario invitado' placeholder when display_name is
--   null) would NOT trigger for anonymous users because '' !== NULL.
--
-- Fix:
--   Use NULLIF to convert the empty string from split_part back to NULL, so
--   anonymous users get a truly NULL display_name rather than an empty string.
--   This preserves the existing email-based display name for registered users.
--
-- Idempotent: `create or replace function` is safe to re-run.
-- ============================================================

create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(
      coalesce(
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1)
      ),
      ''
    )
  );
  return new;
end;
$$ language plpgsql security definer;
