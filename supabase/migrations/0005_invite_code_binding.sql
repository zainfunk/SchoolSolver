-- 0005_invite_code_binding.sql
--
-- Closes finding W2.5 (assessment §9 item 10) -- bind invite codes to
-- identity and time.
--
-- The schema already had `*_code_expires_at` columns, but:
--   1. Admin/advisor codes had no single-use enforcement -- one leak meant
--      every classmate who saw it became admin/advisor.
--   2. Codes were not bound to an email domain, so a code shared in a
--      group chat could be redeemed by anyone with any email.
--
-- This migration adds:
--   * schools.admin_code_used_at timestamptz   -- single-use marker
--   * schools.advisor_code_used_at timestamptz -- single-use marker
--   * schools.student_code_email_domain text   -- optional bind
--   * schools.admin_code_email_domain text     -- optional bind
--   * schools.advisor_code_email_domain text   -- optional bind
--
-- And invalidates every currently-issued code by setting its expires_at
-- to NOW() so that a fresh round (with the new bindings) is generated.
-- This is the SQL counterpart to scripts/rotate-existing-tokens.ts from
-- W1.3.
--
-- Idempotent. Down migration in 0005_invite_code_binding.down.sql.

begin;

-- 1. Single-use markers for admin and advisor codes. Student code stays
--    multi-use (many students per school).
alter table schools
  add column if not exists admin_code_used_at timestamptz,
  add column if not exists advisor_code_used_at timestamptz;

-- 2. Optional email-domain binding. NULL = no restriction, "edu" or
--    "@oakridge.edu" = restrict redemptions to matching addresses.
alter table schools
  add column if not exists student_code_email_domain text,
  add column if not exists admin_code_email_domain text,
  add column if not exists advisor_code_email_domain text;

-- 3. Force regeneration of any code that hasn't already been rotated by
--    the script. Codes generated before W1.3 used Math.random; codes
--    generated before this migration weren't single-use. Rotate them all
--    by expiring now() so /api/join refuses to redeem.
update schools set
  student_code_expires_at = coalesce(student_code_expires_at, now()),
  admin_code_expires_at   = coalesce(admin_code_expires_at,   now()),
  advisor_code_expires_at = coalesce(advisor_code_expires_at, now())
where status in ('active', 'payment_paused');

commit;
