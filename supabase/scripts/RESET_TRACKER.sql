-- ============================================================================
-- RESET_TRACKER.sql -- clear our eight tracker rows so `supabase db push`
-- will (re-)apply 0000..0007 cleanly.
--
-- HOW TO USE:
--   1. Supabase dashboard -> SQL Editor (the </> icon, NOT Migrations)
--   2. Paste this entire file -> Run.
--   3. From your terminal, run:
--        supabase db push
--      The CLI will see the tracker is empty for our eight migrations,
--      apply them in order, and record them. Each migration is
--      idempotent so re-applying on top of an already-applied schema
--      is a no-op.
--
-- This DELETE only touches versions 0000..0007. Any other rows in the
-- supabase_migrations.schema_migrations table (e.g. Supabase's own
-- baseline migrations) are left alone.
-- ============================================================================

DELETE FROM supabase_migrations.schema_migrations
WHERE version IN ('0000','0001','0002','0003','0004','0005','0006','0007');

-- Confirm what's left:
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
