-- 0003_pending_school_onboarding.sql
--
-- Closes finding C-3 in ClubIt-Security-Assessment.md.
-- Implements W2.3 Option A (superadmin approval flow).
--
-- Previously /api/onboard auto-created schools with status='active' and
-- promoted the requester to role='admin' immediately. Anyone who could
-- sign up could squat any school name. This migration adds a column that
-- records WHO is asking to admin a pending school; the approve route
-- (next commit) consults that column to decide whose role to flip.
--
-- The actual enforcement -- "cannot be admin of a pending school" --
-- happens in app code, not RLS, because the existing app.is_school_admin
-- helper reads users.role which is server-set. As long as the onboard
-- route does NOT write role='admin' (which the next commit ensures), the
-- pending status is honored.
--
-- Idempotent. Down migration in 0003_pending_school_onboarding.down.sql.

begin;

alter table schools
  add column if not exists requested_admin_user_id text references users(id) on delete set null;

create index if not exists schools_requested_admin_idx
  on schools (requested_admin_user_id)
  where requested_admin_user_id is not null;

commit;
