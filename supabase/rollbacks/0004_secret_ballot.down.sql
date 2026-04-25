-- 0004_secret_ballot.down.sql
-- Rollback for 0004_secret_ballot.sql.

begin;

drop function if exists app.poll_vote_counts(text);
drop function if exists app.election_vote_counts(text);
drop function if exists app.poll_has_voted(text);
drop function if exists app.election_has_voted(text);

-- Restore election_votes policies from schema.sql (school-wide visibility).
drop policy if exists election_votes_select on election_votes;
create policy election_votes_select on election_votes
  for select to authenticated
  using (app.election_in_scope(election_id));

drop policy if exists election_votes_insert on election_votes;
create policy election_votes_insert on election_votes
  for insert to authenticated
  with check (
    app.election_in_scope(election_id)
    and voter_user_id = app.current_user_id()
  );

commit;
