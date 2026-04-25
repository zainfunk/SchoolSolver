-- 0005_invite_code_binding.down.sql
-- Rollback for 0005. Drops the binding columns; expiry timestamps stay.

begin;

alter table schools
  drop column if exists admin_code_used_at,
  drop column if exists advisor_code_used_at,
  drop column if exists student_code_email_domain,
  drop column if exists admin_code_email_domain,
  drop column if exists advisor_code_email_domain;

commit;
