-- 0004_secret_ballot.sql
--
-- Closes the secret-ballot half of finding C-4 / H-3 in
-- ClubIt-Security-Assessment.md.
--
-- After 0002, poll_votes SELECT was already locked to "own row + superadmin."
-- This migration:
--   1. Applies the same lockdown to election_votes (school-wide vote
--      visibility removed).
--   2. Adds election_votes_insert validation (open election, same school).
--   3. Adds aggregate-only RPCs callable by club managers / school admins
--      so the UI can show "Alex 12, Jordan 8" without anyone learning who
--      voted for whom:
--        app.poll_vote_counts(text) -> table(candidate_user_id, vote_count)
--        app.election_vote_counts(text) -> same shape
--   4. Adds per-user has-voted helpers (no identity exposure):
--        app.poll_has_voted(text) -> boolean
--        app.election_has_voted(text) -> boolean
--
-- Idempotent. Down migration in 0004_secret_ballot.down.sql.

begin;

-- 1. election_votes lockdown (mirrors what 0002 did for poll_votes).
drop policy if exists election_votes_select on election_votes;
create policy election_votes_select on election_votes
  for select to authenticated
  using (
    app.is_superadmin()
    or voter_user_id = app.current_user_id()
  );

drop policy if exists election_votes_insert on election_votes;
create policy election_votes_insert on election_votes
  for insert to authenticated
  with check (
    voter_user_id = app.current_user_id()
    and exists (
      select 1 from school_elections e
      where e.id = election_id
        and e.is_open = true
        and e.school_id = app.current_school_id()
    )
  );

-- 2. Aggregate RPCs for staff / UI. SECURITY DEFINER so they can scan the
--    base tables under their owner's privilege; callers see counts only.
--    The internal authorization check inside each function ensures only
--    legitimate readers get a non-empty result -- everyone else gets back
--    an empty set, which is indistinguishable from "no votes yet."

create or replace function app.poll_vote_counts(target_poll_id text)
returns table (candidate_user_id text, vote_count bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select pv.candidate_user_id::text, count(*)::bigint as vote_count
  from poll_votes pv
  join polls p on p.id = pv.poll_id
  where pv.poll_id = target_poll_id
    and (
      app.is_superadmin()
      or app.club_member(p.club_id, app.current_user_id())
    )
  group by pv.candidate_user_id;
$$;

create or replace function app.election_vote_counts(target_election_id text)
returns table (candidate_user_id text, vote_count bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select ev.candidate_user_id::text, count(*)::bigint as vote_count
  from election_votes ev
  join school_elections e on e.id = ev.election_id
  where ev.election_id = target_election_id
    and (
      app.is_superadmin()
      or e.school_id = app.current_school_id()
    )
  group by ev.candidate_user_id;
$$;

-- 3. Per-user has-voted helpers.
create or replace function app.poll_has_voted(target_poll_id text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from poll_votes
    where poll_id = target_poll_id
      and voter_user_id = app.current_user_id()
  );
$$;

create or replace function app.election_has_voted(target_election_id text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from election_votes
    where election_id = target_election_id
      and voter_user_id = app.current_user_id()
  );
$$;

-- 4. Grants. RPCs declared above are owned by the migration runner; for
--    the application's anon + authenticated roles to call them, grant
--    execute. service_role already has implicit access.
grant execute on function app.poll_vote_counts(text) to authenticated;
grant execute on function app.election_vote_counts(text) to authenticated;
grant execute on function app.poll_has_voted(text) to authenticated;
grant execute on function app.election_has_voted(text) to authenticated;

commit;
