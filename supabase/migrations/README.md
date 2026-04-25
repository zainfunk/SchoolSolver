# Supabase migrations

Apply in numeric order, **forward migrations only**. Each `.down.sql` exists
as a rollback hatch and should never be applied as part of a forward deploy.

```
0000_baseline.sql                 -- copy of supabase/schema.sql; tables, app schema, helper functions, seed
0001_users_rls_lockdown.sql       -- C-5: blocks self-promotion via direct INSERT/UPDATE
0002_club_membership_rls.sql      -- C-4: tightens club-scoped SELECT to members only
0003_pending_school_onboarding.sql -- C-3: schools.requested_admin_user_id column
0004_secret_ballot.sql            -- H-3: poll/election votes are secret; aggregate RPCs added
0005_invite_code_binding.sql      -- W2.5: single-use admin/advisor codes, email-domain bind
0006_audit_log.sql                -- W3.3: append-only audit_log table + app.audit() helper
```

## Applying

### Local (Supabase CLI)

```bash
supabase db reset       # wipes + re-applies all forward migrations in order
# OR for an existing DB:
supabase db push        # applies any migrations not yet recorded
```

### Production (manual, recommended for the first run)

1. Open the Supabase dashboard → SQL Editor.
2. **If this is the first time:** paste `0000_baseline.sql` and run.
   (If `schema.sql` was already applied to this project, skip to step 3 —
   the file is idempotent so re-running is safe but unnecessary.)
3. Apply each subsequent migration one at a time:
   ```bash
   psql "$DATABASE_URL" < supabase/migrations/0001_users_rls_lockdown.sql
   psql "$DATABASE_URL" < supabase/migrations/0002_club_membership_rls.sql
   psql "$DATABASE_URL" < supabase/migrations/0003_pending_school_onboarding.sql
   psql "$DATABASE_URL" < supabase/migrations/0004_secret_ballot.sql
   psql "$DATABASE_URL" < supabase/migrations/0005_invite_code_binding.sql
   psql "$DATABASE_URL" < supabase/migrations/0006_audit_log.sql
   ```

Every forward migration is wrapped in `BEGIN/COMMIT` and is idempotent
(`if exists` / `if not exists`), so running one twice is a no-op.

## If you see `schema "app" does not exist (SQLSTATE 3F000)`

You skipped `0000_baseline.sql`. The `app` schema and the helper
functions (`app.current_user_id`, `app.is_school_admin`, `app.club_member`,
`app.club_in_scope`, etc.) are defined there. Run `0000_baseline.sql`
first, then re-run whichever migration failed.

## Rollback

```bash
psql "$DATABASE_URL" < supabase/migrations/0006_audit_log.down.sql
# ...etc, reverse order
```

Down migrations exist for 0001–0006. The 0000 baseline has no down because
it represents the project's foundational schema.

## Adding a new migration

1. Create `00NN_<short_name>.sql` (numbered immediately after the highest
   existing migration).
2. Wrap in `begin; ... commit;` and use `if exists` / `if not exists` so
   the migration is idempotent.
3. Create a paired `00NN_<short_name>.down.sql` that reverses the change.
4. Add a row to the table at the top of this file.
5. Update `docs/security/W2.4-SERVICE-ROLE-INVENTORY.md` if any new route
   uses `createServiceClient()`.
