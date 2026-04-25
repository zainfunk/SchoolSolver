-- 0001_users_rls_lockdown.sql
--
-- Closes finding C-5 in docs/security/ClubIt-Security-Assessment.md.
--
-- The previous policy permitted authenticated users to insert their own
-- `users` row with any role (including `admin` or `superadmin`) and any
-- school_id. There was no UPDATE policy at all, but no policy means RLS
-- denies UPDATE for `authenticated` -- which sounds safe but actually means
-- the existing application code (which uses the service-role key) is the
-- only thing keeping role/school_id pinned. That's the wrong layer for
-- defense in depth.
--
-- This migration:
--   1. Tightens users_insert_self so a user can only insert their own row
--      as a student with no school yet (the only legitimate self-insert,
--      done by /api/user/sync on first login).
--   2. Adds users_update_self that lets a user change non-privilege
--      fields (name, avatar_url) on their own row only.
--   3. Adds a row-level trigger that blocks role and school_id changes for
--      any non-service-role caller, so the SECURITY-DEFINER admin endpoints
--      (which run as service_role) still work but a direct RLS UPDATE
--      from a hijacked client cannot escalate.
--
-- Idempotent: safe to re-run. Down-migration in 0001_users_rls_lockdown.down.sql.

begin;

-- 1. Replace users_insert_self with the strict version.
drop policy if exists users_insert_self on users;
create policy users_insert_self on users
  for insert
  to authenticated
  with check (
    id = app.current_user_id()
    and role = 'student'
    and school_id is null
  );

-- 2. Add users_update_self -- allows the user to update their own row
--    (subject to the trigger below, which blocks privilege fields).
drop policy if exists users_update_self on users;
create policy users_update_self on users
  for update
  to authenticated
  using (id = app.current_user_id())
  with check (id = app.current_user_id());

-- 3. Trigger to block role and school_id changes from non-service-role
--    callers. Postgres RLS WITH CHECK clauses cannot reference OLD; the
--    trigger is the standard workaround.
create or replace function app.users_block_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_service boolean;
begin
  -- service_role and postgres are the privileged roles in Supabase. The
  -- trigger lets writes from those roles through unchanged. For every
  -- other role (authenticated, anon, etc.) the privileged columns must
  -- match OLD.
  select current_setting('request.jwt.claim.role', true) = 'service_role'
      or current_user = 'service_role'
      or current_user = 'postgres'
    into is_service;

  if is_service then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception
      'role changes via direct UPDATE are not permitted (id=%, attempted role=%)',
      new.id, new.role
      using errcode = '42501'; -- insufficient_privilege
  end if;

  if new.school_id is distinct from old.school_id then
    raise exception
      'school_id changes via direct UPDATE are not permitted (id=%)',
      new.id
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id then
    raise exception
      'users.id is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists users_block_privilege_changes_trg on users;
create trigger users_block_privilege_changes_trg
  before update on users
  for each row
  execute function app.users_block_privilege_changes();

commit;
