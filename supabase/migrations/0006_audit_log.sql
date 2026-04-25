-- 0006_audit_log.sql
--
-- Closes finding W3.3 / assessment §9 item 14.
--
-- Adds an append-only audit_log table + helper RPC. Server routes call
-- `lib/audit.ts.audit({...})` (service-role insert) or invoke the SQL
-- function `app.audit(...)` directly from triggers / functions.
--
-- The table is append-only: UPDATE and DELETE are revoked from every
-- role except postgres (the migration runner). The only legal mutation
-- is INSERT, and even that is gated by a policy that requires
-- service_role.
--
-- Idempotent. Down migration in 0006_audit_log.down.sql.

begin;

create table if not exists audit_log (
  id           bigserial primary key,
  ts           timestamptz not null default now(),
  actor_user_id text       references users(id) on delete set null,
  actor_role   text,
  action       text       not null,
  target_table text,
  target_id    text,
  before_jsonb jsonb,
  after_jsonb  jsonb,
  ip           text,
  user_agent   text,
  request_id   text
);

create index if not exists audit_log_ts_idx     on audit_log (ts desc);
create index if not exists audit_log_actor_idx  on audit_log (actor_user_id, ts desc);
create index if not exists audit_log_target_idx on audit_log (target_table, target_id, ts desc);
create index if not exists audit_log_action_idx on audit_log (action, ts desc);

alter table audit_log enable row level security;

-- Append-only: revoke UPDATE and DELETE from every role we hand out.
-- service_role is the canonical writer (server APIs); even it cannot
-- update or delete rows.
revoke update, delete on audit_log from public;
revoke update, delete on audit_log from authenticated;
revoke update, delete on audit_log from anon;
do $$
begin
  -- service_role exists in Supabase setups; guard against bare-Postgres test envs.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke update, delete on audit_log from service_role';
  end if;
end $$;

-- SELECT: superadmins see everything; school admins see rows whose
-- target school they administer (via target_id matching). For
-- simplicity in this initial cut, school admins see all audit rows
-- (the actor_user_id column scopes naturally via app code). This can
-- be tightened once we instrument enough routes to make the per-school
-- target_id consistent.
drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log
  for select to authenticated
  using (app.is_superadmin() or app.is_school_admin());

-- INSERT: blocked for the authenticated role; service_role bypasses RLS.
-- The lib/audit.ts wrapper uses service_role.
drop policy if exists audit_log_insert on audit_log;
create policy audit_log_insert on audit_log
  for insert to authenticated
  with check (false);

-- SECURITY DEFINER wrapper for use from triggers and from the JS layer.
-- The function captures actor_user_id from the JWT (app.current_user_id);
-- callers that don't have one (webhooks) should pass actorUserId via the
-- JS helper instead, which inserts directly with service_role.
create or replace function app.audit(
  p_action text,
  p_target_table text default null,
  p_target_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_ip text default null,
  p_user_agent text default null,
  p_request_id text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into audit_log(
    actor_user_id, actor_role, action, target_table, target_id,
    before_jsonb, after_jsonb, ip, user_agent, request_id
  ) values (
    app.current_user_id(),
    app.current_role(),
    p_action,
    p_target_table,
    p_target_id,
    p_before,
    p_after,
    p_ip,
    p_user_agent,
    p_request_id
  );
end;
$$;

grant execute on function app.audit(text, text, text, jsonb, jsonb, text, text, text)
  to authenticated;

commit;
