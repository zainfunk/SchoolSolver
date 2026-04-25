-- 0001_users_rls_lockdown.down.sql
--
-- Rollback for 0001_users_rls_lockdown.sql. Restores the schema to the
-- post-schema.sql state (the permissive original users_insert_self, no
-- update policy, no trigger).
--
-- Use only if 0001 is causing legitimate writes to fail and a hotfix is
-- needed. The rollback re-opens finding C-5; a forward fix should land
-- before this is run in any environment that handles real user data.

begin;

drop trigger if exists users_block_privilege_changes_trg on users;
drop function if exists app.users_block_privilege_changes();

drop policy if exists users_update_self on users;

drop policy if exists users_insert_self on users;
create policy users_insert_self on users
  for insert
  to authenticated
  with check (id = app.current_user_id());

commit;
