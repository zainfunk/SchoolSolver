-- 0002_club_membership_rls.sql
--
-- Closes finding C-4 in docs/security/ClubIt-Security-Assessment.md.
-- Plan: docs/security/W2.1-RLS-PLAN.md (approved).
--
-- Re-architects RLS for the 12 club-scoped tables that previously used the
-- school-wide `app.club_in_scope()` helper for SELECT. The fix:
--   - Adds `app.club_leader()` and `app.club_advisor()` helpers.
--   - Replaces SELECT/INSERT/UPDATE/DELETE policies on:
--       chat_messages, attendance_records, attendance_sessions,
--       polls, poll_candidates, poll_votes, club_news, club_forms,
--       form_responses, memberships, join_requests, events
--     so that data is visible to club members + staff only (some hybrids
--     and self-row exceptions per the matrix in W2.1-RLS-PLAN.md §4).
--
-- Out of scope (intentionally school-wide, see plan §4.2):
--   clubs, leadership_positions, club_social_links, meeting_times.
--
-- Idempotent: every drop policy uses `if exists`, every helper uses
-- `create or replace`. Down migration in 0002_club_membership_rls.down.sql
-- restores the policies present in schema.sql.

begin;

-- ============================================================================
-- 1. Helper functions
-- ============================================================================

-- True iff target_user_id holds a leadership_positions row for the club AND
-- the club is in the caller's school. SECURITY DEFINER so policies invoking
-- this function don't recurse into RLS on memberships/leadership_positions.
create or replace function app.club_leader(
  target_club_id text,
  target_user_id text default app.current_user_id()
) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from leadership_positions lp
    join clubs c on c.id = lp.club_id
    where lp.club_id = target_club_id
      and lp.user_id = target_user_id
      and c.school_id = app.current_school_id()
  );
$$;

-- True iff clubs.advisor_id = target_user_id AND in caller's school.
create or replace function app.club_advisor(
  target_club_id text,
  target_user_id text default app.current_user_id()
) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from clubs c
    where c.id = target_club_id
      and c.advisor_id = target_user_id
      and c.school_id = app.current_school_id()
  );
$$;

-- ============================================================================
-- 2. chat_messages
-- ============================================================================

drop policy if exists chat_messages_select on chat_messages;
create policy chat_messages_select on chat_messages
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

drop policy if exists chat_messages_insert on chat_messages;
create policy chat_messages_insert on chat_messages
  for insert to authenticated
  with check (
    sender_id = app.current_user_id()
    and (
      app.is_superadmin()
      or app.club_member(club_id, app.current_user_id())
    )
  );

-- ============================================================================
-- 3. attendance_records
-- ============================================================================

drop policy if exists attendance_records_select on attendance_records;
create policy attendance_records_select on attendance_records
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
    or user_id = app.current_user_id()
  );

drop policy if exists attendance_records_insert on attendance_records;
create policy attendance_records_insert on attendance_records
  for insert to authenticated
  with check (
    app.is_superadmin()
    or app.club_manager(club_id)
    or (
      user_id = app.current_user_id()
      and app.club_member(club_id, user_id)
    )
  );

drop policy if exists attendance_records_update on attendance_records;
create policy attendance_records_update on attendance_records
  for update to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
    or (
      user_id = app.current_user_id()
      and app.club_member(club_id, user_id)
    )
  )
  with check (
    app.is_superadmin()
    or app.club_manager(club_id)
    or (
      user_id = app.current_user_id()
      and app.club_member(club_id, user_id)
    )
  );

-- ============================================================================
-- 4. attendance_sessions
-- ============================================================================

drop policy if exists attendance_sessions_select on attendance_sessions;
create policy attendance_sessions_select on attendance_sessions
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

-- manage policy semantics unchanged; recreate for idempotence.
drop policy if exists attendance_sessions_manage on attendance_sessions;
create policy attendance_sessions_manage on attendance_sessions
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- ============================================================================
-- 5. polls
-- ============================================================================

drop policy if exists polls_select on polls;
create policy polls_select on polls
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

drop policy if exists polls_manage on polls;
create policy polls_manage on polls
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- ============================================================================
-- 6. poll_candidates
-- ============================================================================

drop policy if exists poll_candidates_select on poll_candidates;
create policy poll_candidates_select on poll_candidates
  for select to authenticated
  using (
    app.is_superadmin()
    or exists (
      select 1 from polls p
      where p.id = poll_id
        and app.club_member(p.club_id)
    )
  );

drop policy if exists poll_candidates_manage on poll_candidates;
create policy poll_candidates_manage on poll_candidates
  for all to authenticated
  using (
    app.is_superadmin()
    or exists (
      select 1 from polls p
      where p.id = poll_id
        and app.club_manager(p.club_id)
    )
  )
  with check (
    app.is_superadmin()
    or exists (
      select 1 from polls p
      where p.id = poll_id
        and app.club_manager(p.club_id)
    )
  );

-- ============================================================================
-- 7. poll_votes  (partial -- secret ballot completed in W2.2 / 0004)
-- ============================================================================

-- For W2.1: caller can read their own vote rows; everyone else (including
-- club staff) is denied. Staff aggregates will land in W2.2 via a security
-- definer function/view that returns counts without revealing voter ids.
drop policy if exists poll_votes_select on poll_votes;
create policy poll_votes_select on poll_votes
  for select to authenticated
  using (
    app.is_superadmin()
    or voter_user_id = app.current_user_id()
  );

drop policy if exists poll_votes_insert on poll_votes;
create policy poll_votes_insert on poll_votes
  for insert to authenticated
  with check (
    voter_user_id = app.current_user_id()
    and exists (
      select 1 from polls p
      where p.id = poll_id
        and p.is_open = true
        and app.club_member(p.club_id, app.current_user_id())
    )
  );

-- ============================================================================
-- 8. club_news
-- ============================================================================

drop policy if exists club_news_select on club_news;
create policy club_news_select on club_news
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

drop policy if exists club_news_manage on club_news;
create policy club_news_manage on club_news
  for all to authenticated
  using (app.club_event_creator(club_id))
  with check (
    app.club_event_creator(club_id)
    and author_id = app.current_user_id()
  );

-- ============================================================================
-- 9. club_forms
-- ============================================================================

drop policy if exists club_forms_select on club_forms;
create policy club_forms_select on club_forms
  for select to authenticated
  using (
    app.is_superadmin()
    or app.club_member(club_id)
  );

drop policy if exists club_forms_manage on club_forms;
create policy club_forms_manage on club_forms
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- ============================================================================
-- 10. form_responses
-- ============================================================================

drop policy if exists form_responses_select on form_responses;
create policy form_responses_select on form_responses
  for select to authenticated
  using (
    app.is_superadmin()
    or user_id = app.current_user_id()
    or exists (
      select 1 from club_forms f
      where f.id = form_id
        and app.club_manager(f.club_id)
    )
  );

drop policy if exists form_responses_insert on form_responses;
create policy form_responses_insert on form_responses
  for insert to authenticated
  with check (
    user_id = app.current_user_id()
    and (
      app.is_superadmin()
      or exists (
        select 1 from club_forms f
        where f.id = form_id
          and app.club_member(f.club_id, app.current_user_id())
      )
    )
  );

-- ============================================================================
-- 11. memberships
-- ============================================================================

drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships
  for select to authenticated
  using (
    app.is_superadmin()
    or user_id = app.current_user_id()
    or app.club_member(club_id)
  );

drop policy if exists memberships_insert on memberships;
create policy memberships_insert on memberships
  for insert to authenticated
  with check (
    app.is_superadmin()
    or (
      exists (select 1 from clubs c where c.id = club_id and c.school_id = app.current_school_id())
      and (
        app.club_manager(club_id)
        or (
          user_id = app.current_user_id()
          and app.user_in_scope(user_id)
        )
      )
    )
  );

drop policy if exists memberships_delete on memberships;
create policy memberships_delete on memberships
  for delete to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
    or user_id = app.current_user_id()
  );

-- ============================================================================
-- 12. join_requests
-- ============================================================================

drop policy if exists join_requests_select on join_requests;
create policy join_requests_select on join_requests
  for select to authenticated
  using (
    app.is_superadmin()
    or user_id = app.current_user_id()
    or app.club_manager(club_id)
  );

drop policy if exists join_requests_insert on join_requests;
create policy join_requests_insert on join_requests
  for insert to authenticated
  with check (
    user_id = app.current_user_id()
    and (
      app.is_superadmin()
      or exists (select 1 from clubs c where c.id = club_id and c.school_id = app.current_school_id())
    )
  );

drop policy if exists join_requests_update on join_requests;
create policy join_requests_update on join_requests
  for update to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
  )
  with check (
    app.is_superadmin()
    or app.club_manager(club_id)
  );

drop policy if exists join_requests_delete on join_requests;
create policy join_requests_delete on join_requests
  for delete to authenticated
  using (
    app.is_superadmin()
    or app.club_manager(club_id)
    or user_id = app.current_user_id()
  );

-- ============================================================================
-- 13. events  (HYBRID -- public events visible school-wide)
-- ============================================================================

drop policy if exists events_select on events;
create policy events_select on events
  for select to authenticated
  using (
    app.is_superadmin()
    or (
      exists (select 1 from clubs c where c.id = club_id and c.school_id = app.current_school_id())
      and (
        is_public = true
        or app.club_member(club_id)
      )
    )
  );

drop policy if exists events_manage on events;
create policy events_manage on events
  for all to authenticated
  using (app.club_event_creator(club_id))
  with check (
    app.club_event_creator(club_id)
    and created_by = app.current_user_id()
  );

commit;
