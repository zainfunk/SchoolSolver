# RLS regression tests

These tests verify that the migrations under `supabase/migrations/` produce
the access-control behavior the assessment requires. They need a live
Postgres with the project schema applied and four env vars:

```
SUPABASE_TEST_URL=http://localhost:54321        # local Supabase REST
SUPABASE_TEST_ANON_KEY=<anon key>
SUPABASE_TEST_SERVICE_ROLE_KEY=<service role>
SUPABASE_TEST_JWT_SECRET=<JWT signing secret>
```

`supabase status` prints all four for a local Supabase project. For a
remote test project, fetch them from the Supabase dashboard
(Settings -> API).

## Setup

```bash
# 1. Local Supabase (Docker required)
supabase start
# 2. Apply schema
psql "$SUPABASE_TEST_DB_URL" < supabase/schema.sql
# 3. Apply each migration in order
for f in supabase/migrations/[0-9]*.sql; do
  case "$f" in *.down.sql) continue ;; esac
  psql "$SUPABASE_TEST_DB_URL" < "$f"
done
```

(or use `supabase db reset` if you have a `seed.sql` configured)

## Running

```bash
# Export the four env vars first (or put them in .env.test.local and
# `set -a; source .env.test.local; set +a`).
npm run test:rls
```

## Why a separate config

Vitest's default config (`vitest.config.ts`) excludes `tests/security/rls/**`
because the tests are slow and require infrastructure. The dedicated
config (`vitest.rls.config.ts`) opts them in, gated by env vars at the
test-suite level so a missing `SUPABASE_TEST_URL` produces a clear
"skipped" message rather than a confusing connection error.

## Cleanup

Each test seeds and tears down its own data using IDs prefixed with
`test-wXX-<runId>-`. If a test crashes mid-run, run:

```sql
delete from users where id like 'test-w%-%';
delete from schools where id::text like 'test-w%-%';
```

(this lives in `cleanup.sql` next to the README — tests use a randomly
generated `runId` to avoid collisions across parallel runs.)
