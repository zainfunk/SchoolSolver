-- 0002_club_membership_rls.down.sql
--
-- Rollback for 0002_club_membership_rls.sql. Restores the school-wide
-- policies from schema.sql lines ~746-1027.
--
-- Use only if 0002 is breaking legitimate read paths in production. The
-- rollback re-opens finding C-4; a forward fix should land before this is
-- deployed to any environment serving real users.

begin;

-- chat_messages
drop policy if exists chat_messages_select on chat_messages;
create policy chat_messages_select on chat_messages
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists chat_messages_insert on chat_messages;
create policy chat_messages_insert on chat_messages
  for insert to authenticated
  with check (
    app.club_in_scope(club_id)
    and sender_id = app.current_user_id()
    and app.club_member(club_id, app.current_user_id())
  );

-- attendance_records
drop policy if exists attendance_records_select on attendance_records;
create policy attendance_records_select on attendance_records
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists attendance_records_insert on attendance_records;
create policy attendance_records_insert on attendance_records
  for insert to authenticated
  with check (
    app.club_in_scope(club_id)
    and (
      app.club_manager(club_id)
      or (
        user_id = app.current_user_id()
        and app.club_member(club_id, user_id)
      )
    )
  );

drop policy if exists attendance_records_update on attendance_records;
create policy attendance_records_update on attendance_records
  for update to authenticated
  using (
    app.club_in_scope(club_id)
    and (
      app.club_manager(club_id)
      or (
        user_id = app.current_user_id()
        and app.club_member(club_id, user_id)
      )
    )
  )
  with check (
    app.club_in_scope(club_id)
    and (
      app.club_manager(club_id)
      or (
        user_id = app.current_user_id()
        and app.club_member(club_id, user_id)
      )
    )
  );

-- attendance_sessions
drop policy if exists attendance_sessions_select on attendance_sessions;
create policy attendance_sessions_select on attendance_sessions
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists attendance_sessions_manage on attendance_sessions;
create policy attendance_sessions_manage on attendance_sessions
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- polls
drop policy if exists polls_select on polls;
create policy polls_select on polls
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists polls_manage on polls;
create policy polls_manage on polls
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- poll_candidates
drop policy if exists poll_candidates_select on poll_candidates;
create policy poll_candidates_select on poll_candidates
  for select to authenticated
  using (app.poll_in_scope(poll_id));

drop policy if exists poll_candidates_manage on poll_candidates;
create policy poll_candidates_manage on poll_candidates
  for all to authenticated
  using (app.poll_manager(poll_id))
  with check (app.poll_manager(poll_id));

-- poll_votes
drop policy if exists poll_votes_select on poll_votes;
create policy poll_votes_select on poll_votes
  for select to authenticated
  using (app.poll_in_scope(poll_id));

drop policy if exists poll_votes_insert on poll_votes;
create policy poll_votes_insert on poll_votes
  for insert to authenticated
  with check (
    app.poll_in_scope(poll_id)
    and voter_user_id = app.current_user_id()
    and exists (
      select 1
      from polls p
      where p.id = poll_id
        and app.club_member(p.club_id, app.current_user_id())
    )
  );

-- club_news
drop policy if exists club_news_select on club_news;
create policy club_news_select on club_news
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists club_news_manage on club_news;
create policy club_news_manage on club_news
  for all to authenticated
  using (app.club_event_creator(club_id))
  with check (
    app.club_event_creator(club_id)
    and author_id = app.current_user_id()
  );

-- club_forms
drop policy if exists club_forms_select on club_forms;
create policy club_forms_select on club_forms
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists club_forms_manage on club_forms;
create policy club_forms_manage on club_forms
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

-- form_responses
drop policy if exists form_responses_select on form_responses;
create policy form_responses_select on form_responses
  for select to authenticated
  using (app.form_in_scope(form_id));

drop policy if exists form_responses_insert on form_responses;
create policy form_responses_insert on form_responses
  for insert to authenticated
  with check (
    app.form_in_scope(form_id)
    and user_id = app.current_user_id()
  );

-- memberships
drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists memberships_insert on memberships;
create policy memberships_insert on memberships
  for insert to authenticated
  with check (
    app.club_in_scope(club_id)
    and app.user_in_scope(user_id)
    and (
      app.club_manager(club_id)
      or user_id = app.current_user_id()
    )
  );

drop policy if exists memberships_delete on memberships;
create policy memberships_delete on memberships
  for delete to authenticated
  using (
    app.club_in_scope(club_id)
    and (
      app.club_manager(club_id)
      or user_id = app.current_user_id()
    )
  );

-- join_requests
drop policy if exists join_requests_select on join_requests;
create policy join_requests_select on join_requests
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists join_requests_insert on join_requests;
create policy join_requests_insert on join_requests
  for insert to authenticated
  with check (
    app.club_in_scope(club_id)
    and user_id = app.current_user_id()
  );

drop policy if exists join_requests_update on join_requests;
create policy join_requests_update on join_requests
  for update to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

drop policy if exists join_requests_delete on join_requests;
create policy join_requests_delete on join_requests
  for delete to authenticated
  using (
    app.club_manager(club_id)
    or user_id = app.current_user_id()
  );

-- events
drop policy if exists events_select on events;
create policy events_select on events
  for select to authenticated
  using (app.club_in_scope(club_id));

drop policy if exists events_manage on events;
create policy events_manage on events
  for all to authenticated
  using (app.club_event_creator(club_id))
  with check (
    app.club_event_creator(club_id)
    and created_by = app.current_user_id()
  );

drop function if exists app.club_advisor(text, text);
drop function if exists app.club_leader(text, text);

commit;
