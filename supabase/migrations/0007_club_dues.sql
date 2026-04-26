-- 0007_club_dues.sql
--
-- Adds a per-club dues amount and a per-member dues_payments table so
-- advisors can track who has paid club dues.
--
-- Schema:
--   clubs.dues_amount_cents          -- amount the advisor sets (0 = no dues)
--   club_dues_payments               -- one row per (club, member) once paid/marked
--
-- RLS:
--   SELECT  - club managers (advisor + admin) see all rows in scope;
--             members see their own row.
--   INSERT  - club managers only.
--   UPDATE  - club managers only.
--   DELETE  - club managers only.
--
-- Idempotent. Down migration in 0007_club_dues.down.sql.

begin;

alter table clubs
  add column if not exists dues_amount_cents int not null default 0;

create table if not exists club_dues_payments (
  id            text primary key,
  club_id       text not null references clubs(id) on delete cascade,
  user_id       text not null references users(id) on delete cascade,
  paid          boolean not null default false,
  paid_at       text,
  amount_cents  int not null default 0,
  marked_by     text references users(id) on delete set null,
  updated_at    text not null,
  unique(club_id, user_id)
);

create index if not exists club_dues_payments_club_idx on club_dues_payments (club_id);
create index if not exists club_dues_payments_user_idx on club_dues_payments (user_id);

alter table club_dues_payments enable row level security;

drop policy if exists club_dues_payments_select on club_dues_payments;
create policy club_dues_payments_select on club_dues_payments
  for select to authenticated
  using (
    app.club_manager(club_id)
    or (app.club_in_scope(club_id) and user_id = app.current_user_id())
  );

drop policy if exists club_dues_payments_manage on club_dues_payments
;
create policy club_dues_payments_manage on club_dues_payments
  for all to authenticated
  using (app.club_manager(club_id))
  with check (app.club_manager(club_id));

commit;
