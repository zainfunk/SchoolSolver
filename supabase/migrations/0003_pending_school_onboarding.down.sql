-- 0003_pending_school_onboarding.down.sql
-- Rollback for 0003. Drops the requested_admin_user_id column.
-- Use only if 0003 must be reverted; the W2.3 approval flow stops working.

begin;

drop index if exists schools_requested_admin_idx;
alter table schools drop column if exists requested_admin_user_id;

commit;
