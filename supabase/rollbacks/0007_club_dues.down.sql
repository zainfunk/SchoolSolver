-- 0007_club_dues.down.sql -- Rollback for the club dues feature.
-- `drop table` cascades to its policies, so we don't need explicit
-- `drop policy` calls (those would fail with 42P01 if the table is
-- already gone — `if exists` only guards the policy name, not the table).
begin;
drop table if exists club_dues_payments;
alter table clubs drop column if exists dues_amount_cents;
commit;
