# Supabase one-shot scripts

These are operator-only scripts for the Supabase **SQL Editor** (not for
`supabase db push`). They live outside `../migrations/` so the
auto-apply tool doesn't pick them up as migrations.

## What's here

- **`APPLY_ALL.sql`** — every forward migration (0000..0006) concatenated
  in order. Paste into the SQL Editor on a fresh project, run, done.
  Idempotent so re-running on an already-applied DB is a no-op.

- **`RESET_AND_APPLY.sql`** — same as `APPLY_ALL.sql` but bracketed by
  a DELETE on `supabase_migrations.schema_migrations` (cleans stale
  tracker rows for our seven versions) and a re-INSERT after the
  migrations succeed. Use this when the Supabase Migrations tool has
  partial state and is throwing duplicate-key errors.

- **`RESET_TRACKER.sql`** — DELETE only. Use when the schema is already
  correct but the bookkeeping table has rows you want gone before the
  next `supabase db push`.

## Why are these not migrations?

Supabase's auto-apply path treats every `.sql` in `migrations/` as a
forward migration and records it in
`supabase_migrations.schema_migrations`. Our `RESET_*.sql` files
intentionally write to that table — if they were in `migrations/`,
`supabase db push` would try to record them too, causing infinite
loops or duplicate-key conflicts.
