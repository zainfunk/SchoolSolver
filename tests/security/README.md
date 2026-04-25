# Security regression tests

Each finding from `docs/security/ClubIt-Security-Assessment.md` that gets
remediated MUST land with a test in this directory that fails on the
unfixed code and passes on the fixed code.

## Layout

- `test_w1_*.spec.ts` — Wave 1 regression tests, runnable via `npm test`
  (uses Vitest, no browser needed).
- `rls/` — RLS / database policy tests. These need a live Postgres with
  the project schema applied. Run with `npm run test:rls` (added in
  Wave 1.4). They mint Supabase JWTs locally instead of going through
  Clerk so they're deterministic.

## Adding a test

1. Reproduce the vulnerability in a failing test against the unfixed
   tree (or a fixture that simulates it).
2. Land the fix.
3. Run the test against the fixed tree — it must pass.
4. Commit with `Closes finding <ID> from ClubIt-Security-Assessment.md`.
