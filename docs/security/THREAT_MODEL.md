# ClubIt Threat Model (STRIDE)

This is a system-level threat model. It is scoped to the production
deployment described in the README architecture diagram: Next.js on Vercel
in front of Clerk (auth), Supabase (Postgres + RLS + realtime), and Stripe
(billing).

Findings prefixed with letters (`C-`, `H-`, `M-`, `L-`) reference the
external assessment in `ClubIt-Security-Assessment.md`. The "remediation"
column cites the commit/wave that closed it; "residual risk" describes
what could still go wrong after the fix is applied.

The model is not exhaustive. It covers the assets we have already
deemed in-scope for the security wave: Clerk authentication, Supabase
RLS, Stripe webhooks, invite codes, and the school tenant boundary.
Re-run this analysis whenever a new attack surface is added (new vendor,
new public endpoint, new data category).

<!-- TODO(security): re-review this document at least once per release cycle and after every architectural change. -->

## Trust boundaries

1. Public internet → Vercel edge.
2. Vercel function → Clerk (verifies session JWT).
3. Vercel function → Supabase (service role bypasses RLS; per-request JWT does not).
4. Browser → Supabase (anon key + Clerk-signed JWT, RLS-enforced only).
5. Stripe → Vercel (signed webhook).
6. School tenant A ↔ School tenant B (same Postgres, same Clerk tenant — must remain logically isolated).

## STRIDE matrix

### Spoofing

| Asset | Threat | Mitigation in place | Residual risk |
|---|---|---|---|
| Clerk identity | Attacker forges or replays a Clerk session JWT to impersonate a user. | Clerk middleware (`proxy.ts`) verifies JWT signature on every request; `@clerk/nextjs >= 7.2.7` patches GHSA-vqx2-fgx2-5wq9 (assessment **C-2**, fix `aea5419`). | Compromise of the Clerk tenant itself (e.g., another secret leak) bypasses every other control. Treated as catastrophic — see `INCIDENT_RESPONSE.md`. |
| Display identity in chat / rosters | User sets `user_overrides.name` to "Principal Hayes" and impersonates staff (**H-2**). | <!-- TODO(security): outstanding. Plan: server-side validate that override email matches Clerk primary email; flag staff-suffix names for admin review. --> | Until fixed, any classmate can socially-engineer inside chat. |
| School-tenant identity (onboarding) | Student claims to be admin of "University High School" via `/api/onboard` (**C-3**). | `/api/onboard` now creates a `pending_school` row that requires superadmin approval before activation (commit `131ac42`). | Superadmin approval is human-in-loop; if a superadmin approves a fraudulent claim, downstream tenant gets created with attacker as admin. Mitigation: out-of-band verification before approval (documented in IR runbook). |
| Stripe webhook origin | Forged webhook to `/api/webhooks/stripe` flips a school's `subscription_status` to `active` (**C-6**). | <!-- TODO(security): pending W3 — delete duplicate handler `app/api/webhooks/stripe/route.ts`; keep only the signed `app/api/stripe/webhook/route.ts`; add startup check that fails build if `STRIPE_WEBHOOK_SECRET` unset in prod. --> | Until duplicate is removed, mis-deploy without `STRIPE_WEBHOOK_SECRET` accepts unsigned events. |

### Tampering

| Asset | Threat | Mitigation in place | Residual risk |
|---|---|---|---|
| `users.role` / `users.school_id` | Newly-created user inserts their own row with `role='superadmin'` via direct supabase-js call (**C-5**). | RLS lockdown migration `0001_users_rls_lockdown.sql` (commit `32bb45d`) constrains `users` insert to `role='student'`, `school_id=null`, and forbids client `UPDATE` of role/school. | Service-role API routes can still flip role server-side; covered by **H-9** audit-logging gap (open). |
| Invite codes / setup tokens | Attacker predicts a setup-link token by observing `Math.random()` outputs from another tenant's onboarding (**C-7**). | `lib/schools-store.ts` now uses `crypto.randomBytes()` for codes and tokens (commit `80d8dc9`). Existing tokens migrated by `scripts/rotate-existing-tokens.ts`. | Token guessability is closed; binding tokens to identity / TTL still open (assessment §9 item 10). |
| Profile `socials` JSONB | Attacker stores `javascript:` URL inside profile that renders as an `<a href>` (**H-10**). | <!-- TODO(security): pending W2.x — Zod-validate the socials shape and restrict URL scheme to http/https on write; sanitize again on read. --> | Browser `javascript:` URL handling differs by browser/version; React's `href` heuristic is not a guarantee. |
| Schema migrations | Drift between `schema.sql` and `migrations/`. | All schema changes after W1 land in numbered migrations with `.down.sql`. | Cold-bootstrap via `schema.sql` may not match a long-lived prod environment — see CHNG note in `HECVAT_LITE_RESPONSES.md`. |

### Repudiation

| Asset | Threat | Mitigation in place | Residual risk |
|---|---|---|---|
| Admin role changes | A rogue admin appoints a co-admin and demotes real staff with no audit trail (**H-9**). | <!-- TODO(security): audit logging is in the W3 backlog. Append-only `audit_log` table + writes from every privileged route. --> | Until shipped, post-incident forensics depend entirely on Vercel function logs (which are ephemeral, **M-7**). |
| Vote casting | Voter denies casting a particular vote / cannot prove they did. | Each vote insert is uniquely keyed (`election_id, voter_user_id`); secret-ballot policy hides voter identity from clients (**H-3**, commit `a4a419b`). | Voter identity is still in the row server-side for replay protection — accepting that as the trade-off documented in `0004_secret_ballot.sql`. |
| Profile overrides | A user repudiates an offensive display name by claiming someone else changed it. | RLS scopes overrides to the user's own row. | Without audit log, no chain of custody for the override field. Same gap as above. |
| Stripe events | Disputed billing actions can be reconstructed only from Stripe's dashboard. | Stripe events are stored server-side in `subscriptions` (signed handler). | We do not yet write a local audit copy with Stripe event ID for every billing change. |

### Information disclosure

| Asset | Threat | Mitigation in place | Residual risk |
|---|---|---|---|
| Cross-club data inside a school (chat, attendance, votes, rosters, advisor GPS) | Any authenticated user `SELECT *` from `chat_messages`, `attendance_sessions`, `poll_votes`, etc. (**C-4**). | Membership-only RLS migration `0002_club_membership_rls.sql` (commit `ca928df`) replaces `club_in_scope` with `app.club_member`. Regression matrix in `tests/security/` (`d92bdbb`). Realtime subscriptions inherit the new RLS. | Service-role API routes can still over-fetch if a `school_id` filter is forgotten; defense-in-depth requires **C-8** rework (open). |
| Voter identity (poll / election ballots) | Voters can be matched to candidates (**H-3**). | Migration `0004_secret_ballot.sql` (commit `a4a419b`) drops `voter_user_id` from policy USING clauses; APIs now return only aggregate counts. | Service-role queries still see `voter_user_id` server-side; treat as confidential and never log. |
| Setup-link invite codes | Anonymous GET of `/api/setup/[token]` returns three invite codes (**H-6**). | <!-- TODO(security): bind setup tokens to school + admin email, add 7-day TTL and one-time-use semantics. Tracked in W2 backlog. --> | Predictability is closed (C-7), but the endpoint still leaks all three codes if a token is shared. |
| Vercel function logs | PII written to `console.error` ends up in shared platform logs (**M-7**). | <!-- TODO(security): structured logger with PII redaction; exclude email + names from error payloads. --> | Until shipped, treat all log output as containing PII for retention purposes. |
| Leaderboard | Returns student totals regardless of `user_privacy_settings.achievements_public` (**M-4**). | <!-- TODO(security): honor privacy flag in `app/api/school/leaderboard/route.ts`. --> | Privacy toggle is non-functional; user expectation gap. |

### Denial of service

| Asset | Threat | Mitigation in place | Residual risk |
|---|---|---|---|
| `/api/onboard`, `/api/checkout`, profile endpoints | Brute-force or floods exhaust DB connections / Stripe quotas (**H-8**). | <!-- TODO(security): replace in-memory `lib/rate-limit.ts` with Upstash Ratelimit or Postgres-backed limiter; cover all listed routes. Tracked in W3. --> | Vercel auto-scales and Supabase has connection limits — a determined attacker can degrade the platform without rate limits. |
| Realtime subscriptions | A client subscribes to every school-wide table at once. | Supabase realtime applies RLS; with C-4 fix, only club-member rows stream. | A user with broad memberships still receives many channels; no per-user channel cap. |
| Setup-link probing | Brute-forcing tokens at `/api/setup/[token]`. | Tokens now have 128 bits of entropy (C-7 fix). | Without rate limiting, brute force is still computationally infeasible but observability is bad — no anomaly alerting. |

### Elevation of privilege

| Asset | Threat | Mitigation in place | Residual risk |
|---|---|---|---|
| Self-promotion to superadmin | New user inserts `users.role='superadmin'` (**C-5**). | RLS lockdown (`0001_users_rls_lockdown.sql`). | Closed at the data layer; remaining risk is server-side mis-write under service role (covered by **C-8** plan). |
| Admin escalation via invite-code resubmission | Student obtains the admin invite code and re-submits to `/api/join` (**H-1**). | <!-- TODO(security): bind invite codes to email/domain + add expiry + one-time-use. Tracked in W2. --> | Open. Mitigated only by code rotation, which is manual. |
| Dev routes in production (`/api/dev/school-lab`, `/api/superadmin/invite`) (**H-5**, **L-7**) | Any signed-in user becomes admin in a misconfigured prod build. | `npm run build:prod` strips dev routes and `scripts/check-no-dev-routes.mjs` fails the build if any leak through (commit `27264f7`, finding **W1.6**). | Vercel preview builds that don't run `build:prod` could still ship dev routes — Codemagic uses `build:prod`; Vercel project setting must too. |
| Service-role bypass everywhere (**C-8**) | A forgotten `school_id` filter exposes cross-tenant data. | Per-route TS authorization checks are the current control. | Architectural; W3 plan is to migrate to per-request anon clients carrying Clerk JWT and let RLS enforce. |
| Cross-club poll voting (**H-4**) | A non-member of a club casts a leadership vote. | <!-- TODO(security): add server-side membership check in `cast_poll_vote`; the RLS already enforces it but service-role bypasses. --> | Open. |

## Tenant boundary — explicit invariants

These must hold; if any one is violated, classify as S0 in the IR runbook.

1. A user in school A cannot read or write any row whose `school_id != A`.
2. A user who is not a member of club X cannot read membership-private
   tables (chat, attendance, polls, news, forms) for club X, even if X is in
   their school.
3. A user cannot change their own `role` or `school_id` from the client.
4. A `pending_school` row cannot become a real `schools` row without a
   superadmin approval action.
5. A Stripe event cannot mutate `schools` unless its signature verifies.
6. A setup-link token can only be redeemed by a user whose Clerk email
   matches the school's `contact_email`. <!-- TODO(security): not yet enforced — invariant aspirational pending W2. -->

Failures of (1)–(5) are remediated as of HEAD; (6) is the next priority.
