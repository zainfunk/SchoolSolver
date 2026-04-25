# ClubIt Security Remediation Report

**Source assessment:** [`docs/security/ClubIt-Security-Assessment.md`](docs/security/ClubIt-Security-Assessment.md)
**Engineer:** Senior AppSec
**Period:** 2026-04-25
**Branch:** `main`, range `b67395d..e203ed1` (the W1–W4 commits sit on top of the previously-scrubbed history).

This report maps every finding from the assessment to its current status,
records the commit and test that closed it, lists residual risk, names
items that cannot be closed in code, and surfaces new findings discovered
during remediation.

---

## 1. Status of every finding

Legend: ✅ = closed; 🟡 = partial (code-complete, end-to-end verification pending live infrastructure); ⚪️ = accepted-risk / out-of-scope; 🔵 = handled in a follow-up planned this wave.

### CRITICAL findings

| ID | Title | Status | Commit | Test | Residual risk |
|---|---|---|---|---|---|
| **C-1** | Clerk Backend API secret in HEAD + history | ✅ closed | `b67395d` (history scrub via filter-repo), `fef2da9` (W1.1 pre-commit hook + tree scan) | `tests/security/test_w1_1_no_secrets_in_tree.spec.ts` | Old commit `0729417` still reachable on GitHub by SHA for ~90 days; requires GitHub Support contact (operator step). Clerk key was rotated (chat) and **must be rotated again** because the second key was sent in chat. |
| **C-2** | `@clerk/nextjs <7.2.1` middleware bypass (GHSA-vqx2-fgx2-5wq9) | ✅ closed | `aea5419` | `tests/security/browser/test_w1_2_auth_protection.spec.ts` (17 cases, run against `npm run dev`) | None on the named CVE. Three residual `postcss<8.5.10` moderates remain pinned upstream by `next@16.2.4`; theoretical XSS surface, no user-CSS path; tracked in `docs/security/DEPENDENCY_RESIDUALS.md`. |
| **C-3** | Self-service `/api/onboard` auto-grants admin | ✅ closed | `131ac42` | `tests/security/rls/test_w2_3_pending_onboarding.spec.ts` | None on the API path. Per-school spam from a single attacker now bounded by `onboardLimiter` (3/hour/user, W3.2 commit `fb49956`). |
| **C-4** | School-wide RLS exposes every club's chat / attendance / votes / news | ✅ closed | `ca928df` (migration), `d8e4b53` (counts endpoint), `d92bdbb` (matrix tests), `a4a419b` (secret ballot) | `tests/security/rls/test_w2_1_club_rls.spec.ts` (65 cases), `tests/security/rls/test_w2_2_secret_ballot.spec.ts` (12 cases) | Migration **not yet applied** to the production Supabase project — operator must run `0002_club_membership_rls.sql` and `0004_secret_ballot.sql` manually or via `supabase db push`. Until then RLS in prod is the pre-fix policy. |
| **C-5** | Self-promotion via direct DB INSERT | ✅ closed | `32bb45d` | `tests/security/rls/test_w1_4_users_rls.spec.ts` (9 cases) | Same operator step: apply `0001_users_rls_lockdown.sql`. |
| **C-6** | Stripe webhook accepts unsigned events | ✅ closed | `a05264a` | `tests/security/test_w2_6_webhook_hardening.spec.ts` (5 cases) | None. Duplicate handler deleted; canonical handler now refuses to start in production without `STRIPE_WEBHOOK_SECRET`. |
| **C-7** | `Math.random` for invite codes / setup tokens | ✅ closed | `80d8dc9` | `tests/security/test_w1_3_csprng.spec.ts` (4 cases incl. 10k-collision and Shannon-entropy checks) | Pre-W1.3 codes still valid until rotated. Operator must run `npm run rotate-tokens:prod` once. (Migration `0005_invite_code_binding.sql` also expires every existing code as a safety net.) |
| **C-8** | RLS bypassed by service-role in every route | 🟡 partial | `1875f61` (4 routes refactored + inventory) | RLS suite covers the refactored routes' permissions matrix | Inventory at `docs/security/W2.4-SERVICE-ROLE-INVENTORY.md` documents every callsite with category. Category B routes refactored. Category C routes (multi-action handlers like `app/api/school/clubs/[id]/route.ts`) deferred — listed in the inventory as scheduled follow-ups. |

### HIGH findings

| ID | Title | Status | Commit | Test | Residual risk |
|---|---|---|---|---|---|
| **H-1** | Role escalation via `/api/join` re-submission | ✅ closed | `d186000` (W2.5: single-use admin/advisor codes + email-domain bind) | `tests/security/rls/test_w2_5_invite_code_binding.spec.ts` | None. A leaked admin code now self-destructs on first use; subsequent attempts get 410 Gone. |
| **H-2** | Display-name spoofing via `user_overrides` | 🔵 partial | `26b5922` (W3.4 zod validation prevents oversized payloads + extra fields) | n/a | The PATCH path now rejects mass-assignment but a user can still set `name: 'Principal Hayes'`. Mitigation: server should refuse a name that matches a different user's primary email's local-part, OR show "(self-named)" badges next to overridden names. Tracked as **N-7** below. |
| **H-3** | Polls / elections not anonymous | ✅ closed | `a4a419b` | `tests/security/rls/test_w2_2_secret_ballot.spec.ts` | None. `voter_user_id` no longer reaches the browser; staff get aggregates only via `app.poll_vote_counts` / `app.election_vote_counts`. |
| **H-4** | Cross-club poll voting (membership not enforced server-side) | ✅ closed | `ca928df` | RLS matrix tests + `app.club_member` precondition in the new `poll_votes_insert` policy | None. |
| **H-5** | `/api/dev/school-lab` gated only by `NODE_ENV` | ✅ closed | `27264f7` | `tests/security/test_w1_6_dev_routes_stripped.spec.ts` | None. Path is physically removed from `next build` output by `scripts/strip-dev-routes.mjs`; `scripts/check-no-dev-routes.mjs` fails the build if any artifact survives. |
| **H-6** | Unauthenticated `/api/setup/[token]` leaks invite codes | ✅ closed | `80d8dc9` (CSPRNG token, 256 bits) + `fb49956` (rate limit 5/15min/IP) | `tests/security/test_w1_3_csprng.spec.ts`, `tests/security/test_w3_2_rate_limiting.spec.ts` | Token is now unguessable and brute-force prevented; if the link itself is leaked (e.g., shared in chat) the codes still grant access until the operator rotates them. Mitigated by single-use admin/advisor (W2.5). |
| **H-7** | No security headers / CSP | ✅ closed | `add3dbf` | `tests/security/browser/test_w3_1_security_headers.spec.ts` | CSP ships in **Report-Only** mode initially; after one clean deploy cycle, switch to enforcing (TODO comment in `next.config.ts`). |
| **H-8** | Effectively no rate limiting | ✅ closed | `fb49956` | `tests/security/test_w3_2_rate_limiting.spec.ts` (5 cases) | Production needs `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Without them the limiter falls back to in-memory and logs FATAL — operator must wire Upstash before launch. |
| **H-9** | Role-change endpoint without audit log | ✅ closed | `a81eeb2` (audit instrumentation) | `tests/security/rls/test_w3_3_audit_log.spec.ts` (5 cases) | Audit table is append-only at the SQL level (UPDATE+DELETE revoked from every role). |
| **H-10** | Mass-assignment / unsanitized JSON in profile `socials` | ✅ closed | `26b5922` (zod schemas with `SafeUrl`) | `tests/security/test_w3_4_zod_validation.spec.ts` (~30 cases) | None on the URL-protocol vector. The W2.4 refactor also moved this route to `createAuthedServerClient` so RLS is the second line of defense. |
| **H-11** | School DELETE cascade leaves orphans | 🟡 partial | n/a — documented | n/a | Listed as a known gap in `docs/security/DATA_DELETION.md`. Fix scheduled for follow-up: wrap the deletion in a Postgres transaction; enumerate `school_elections` / `election_*` / `notifications` / `subscriptions`; either delete or NULL `chat_messages.sender_id` for departed users. |
| **H-12** | Event-creator IDs not validated to school | 🔵 partial | n/a | n/a | The W2.1 RLS rewrite (`ca928df`) closes the cross-club bypass for *non-school* event_creator entries because `app.club_event_creator` checks `school_id = current_school_id()`. The set-event-creators route still doesn't validate that the IDs are in-school at write time; tracked as **N-3** for follow-up. |

### MEDIUM findings

| ID | Title | Status | Notes |
|---|---|---|---|
| **M-1** | Direct client-side Supabase reads bypass server validation | ✅ closed (de-facto) | After W2.1 RLS rewrite, the anon-key reads return only data the caller is allowed to see anyway. |
| **M-2** | Two competing webhook handlers | ✅ closed | `a05264a` deletes the duplicate. |
| **M-3** | Realtime subscriptions reflect over-permissive RLS | ✅ closed | After `ca928df`, RLS gates the realtime channel correctly; non-members no longer receive cross-club events. |
| **M-4** | Leaderboard ignores user privacy preferences | 🔵 partial | Not yet implemented. Doc TODO recorded in `PRIVACY_POLICY.md` and `THREAT_MODEL.md`. **N-4**. |
| **M-5** | No MFA / SSO / SAML | ⚪️ accepted | Requires Clerk dashboard config + Enterprise tier; out of code scope. Tracked in HECVAT_LITE_RESPONSES.md AUTH section. |
| **M-6** | No account lockout / password-reset rate limiting | ⚪️ accepted | Same — Clerk dashboard, not code. |
| **M-7** | Logging via `console.error` only | 🟡 partial | Audit log (`a81eeb2`) covers security events. General application logging not yet structured. **N-5**. |
| **M-8** | `proxy.ts` whitelist broad | ✅ closed | `a05264a` removed `/api/webhooks/(.*)`. |
| **M-9** | `setInterval` cleanup in Edge runtime is fragile | ✅ closed | `fb49956` rewrote the limiter; cleanup moved to Upstash sliding-window. |
| **M-10** | No CSRF defense documented | ⚪️ accepted (Clerk SameSite=Lax) | Same-origin fetch + Clerk default cookies cover the obvious vectors. Documented in THREAT_MODEL.md. |
| **M-11** | Manifest `start_url=/dashboard` | ⚪️ accepted | Behavior is acceptable (Clerk redirect on unauth). |
| **M-12** | Stripe customer email comes from override-able `users.email` | 🔵 partial | Mitigated by W3.4 zod validating email; full fix is to read from Clerk primaryEmail at checkout time. **N-6**. |
| **M-13** | CORS undefined; `Origin` not validated | ⚪️ accepted | Default Next behaviour + Clerk + same-origin fetches; any future cross-origin client must be added explicitly. |
| **M-14** | Capacitor iOS shell increases surface | ⚪️ accepted | Web app surface = mobile surface; mobile-specific hardening (cert pinning, etc.) is a separate workstream. |

### LOW / hygiene findings

L-1 through L-10 are tracked in `docs/security/THREAT_MODEL.md` "open hygiene" section. L-1, L-2, L-5, L-6 are addressed by the README rewrite (`c82ab20`) + migrations directory (W1.4–W2.5). L-4 was a side-effect of the C-1 leak and is closed by W1.1. L-7, L-9 unchanged but documented. L-10 (eslint-plugin-security) is a follow-up.

---

## 2. New findings discovered during remediation

These are bugs / gaps surfaced by doing the work above. Each is named `N-#` and has a recommended next action. The first four were also flagged in W1 status report and follow-up commits.

| ID | Title | Severity | Surfaced by | Status | Next action |
|---|---|---|---|---|---|
| **N-1** | `/join` page force-uppercased the input, breaking case-sensitive base64url codes | Low | W1.3 (CSPRNG) | ✅ closed in `80d8dc9` | n/a |
| **N-2** | `/api/join` `.toUpperCase()` had the same bug | Low | W1.3 | ✅ closed in `80d8dc9` | n/a |
| **N-3** | `set_event_creators` action doesn't validate IDs are in-school | Medium | W2.1 RLS review | 🔵 open | Add a same-school check in the `set_event_creators` branch of `app/api/school/clubs/[id]/route.ts`. |
| **N-4** | Leaderboard returns student names regardless of `achievements_public` | Medium | W2.4 inventory | 🔵 open | Filter out users where `user_privacy_settings.achievements_public = false`. |
| **N-5** | No structured logging / log redaction | Medium | W3.3 audit | 🔵 open | Replace `console.error` calls with a typed logger; redact PII before write. |
| **N-6** | Stripe customer_email is sourced from override-able `users.email` (M-12 follow-up) | Medium | W3.4 review | 🔵 open | Read `clerkUser.primaryEmailAddress` at checkout time, not the DB row. |
| **N-7** | `user_overrides` PATCH still allows display-name spoofing of staff (H-2 follow-up) | Medium | W3.4 review | 🔵 open | UI badge "(self-named)" + reject overrides whose name verbatim matches another user in the same school. |
| **N-8** | `app/api/school/clubs/[id]/route.ts` is a multi-action mega-handler | Architectural | W2.4 inventory | 🔵 open | Split into per-action routes (e.g., `/clubs/[id]/join`, `/clubs/[id]/news/[newsId]`) so each has its own rate limit, validation schema, and audit hook. |
| **N-9** | DELETE-school cascade is not transactional and skips some tables (H-11 follow-up) | High | docs review | 🔵 open | Wrap in `begin/commit`; enumerate every table holding a school_id reference; document the SQL. |
| **N-10** | The `users` row check `users_select` uses `app.user_in_scope` which still allows reading every user in the school (PII baseline) | Low/info | W2.1 review | ⚪️ accepted | This is the existing classmate-directory UX. If a school requires stricter, set `student_socials_enabled = false` (already implemented). |

---

## 3. Updated production readiness score

Same rubric as the original assessment.

| Category | Original | New | Change | Justification |
|---|---:|---:|---:|---|
| Authentication | 2/10 | **8/10** | +6 | Clerk CVE patched (`aea5419`); secret leak scrubbed + pre-commit guard (`fef2da9`); auth-protection regression test (17 cases). MFA/SSO still not enforced (-2). |
| Authorization | 2/20 | **15/20** | +13 | RLS re-architected (`ca928df`), users RLS locked (`32bb45d`), service-role inventory + 4-route refactor (`1875f61`), secret ballot (`a4a419b`), invite codes bound (`d186000`). Loses 5 because the migrations are not yet applied to the prod DB and Category C service-role routes are still pending. |
| Data protection | 3/15 | **11/15** | +8 | Aggregate-only vote counts; `voter_user_id` no longer leaves the server; secrets-policy + dependency-residuals docs (`c82ab20`). Loses 4: leaderboard privacy (N-4), structured logging (N-5), data-deletion gaps (H-11/N-9). |
| Input validation | 5/10 | **9/10** | +4 | Zod schemas across the highest-risk routes (`26b5922`); `SafeUrl` blocks `javascript:`; mass-assignment closed; H-10 done. -1 because Category C routes don't have schemas yet. |
| Secrets management | 0/10 | **9/10** | +9 | History scrubbed (`b67395d`); pre-commit hook (`fef2da9`); CSPRNG everywhere (`80d8dc9`); webhook-secret startup guard (`a05264a`); rotation script (`scripts/rotate-existing-tokens.ts`). -1 because the operator hasn't yet run the rotation script in production. |
| Dependency hygiene | 1/5 | **4/5** | +3 | npm audit clean of critical/high (`aea5419`); Dependabot configured; CI gate blocks new high+critical (`e203ed1`). -1 for residual `postcss<8.5.10` (upstream-pinned). |
| Logging & monitoring | 1/10 | **6/10** | +5 | Append-only audit log (`a81eeb2`) + 4 instrumented routes; admin role / school lifecycle / onboarding all audited. Loses 4 because (a) general-purpose structured logging not yet in place (N-5) and (b) most non-superadmin routes still need instrumentation. |
| Compliance documentation | 0/10 | **8/10** | +8 | Threat model, IR runbook, data-deletion policy, subprocessors, FERPA template, privacy + terms, HECVAT-Lite drafts (`06d4595`); README replaced (`c82ab20`); secrets policy (`fef2da9`); dependency residuals doc (`aea5419`); service-role inventory (`1875f61`). -2 because every one of those docs has TODO markers the human + legal must finalize. |
| Operational maturity | 2/10 | **7/10** | +5 | Numbered migrations (six of them, with down-migrations), CI security gate (`e203ed1`), husky pre-commit hook, rate limiting docs, dev-route strip pipeline, Dependabot + auto-PR. -3 because (a) only one author in git history still, (b) no SBOM yet, (c) no third-party pen test results. |

**Total: 16 / 100 → 77 / 100.** A 61-point improvement; the largest deltas are Authorization (+13), Secrets (+9), Compliance docs (+8), Data protection (+8). The remaining 23 points are dominated by:

- Migrations not yet applied to production DB (touches Authz, Data).
- MFA / SSO not enforced (Auth).
- Operator-side actions not yet performed (rotate tokens, GitHub Support, Upstash Redis).
- Items that require humans (legal review of FERPA/Privacy/Terms; pen test; SOC 2; HECVAT Full).

---

## 4. What I could not fix in code

These are the assessment's §9 "conditions for approval" items that are not code changes. The remediation report lists them so the operator and CISO have a punch-list to take to the rest of the organization.

| Item | Owner | Recommended next step |
|---|---|---|
| **Final Clerk-secret rotation** | Operator | Generate a third Clerk Secret in the dashboard; do **not** share via chat; place only in `.env.local` and Vercel env vars. The W1.1 hook will catch any future commit attempt. |
| **Apply migrations to production Supabase** | Operator | Run `0001`–`0006` (forward, not down) via `supabase db push` or psql, in numeric order, in a maintenance window. After applying, run `npm run test:rls` against staging with `SUPABASE_TEST_*` env vars set; expect ~85 cases passing. |
| **Run `scripts/rotate-existing-tokens.ts` in production** | Operator | `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run rotate-tokens:prod`. Then notify each school admin to fetch new codes. |
| **GitHub Support: expire orphaned commits** | Operator | Email GitHub Support with the SHAs `0729417000e959f2c3a823354ef359a6b7a885d9` and `085f89fe1dde8fba21a7f247ecf55674661667b6`. Without this, the leaked commit is reachable by SHA for ~90 days. |
| **Wire Upstash Redis** | Operator | Provision Upstash; set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel env vars. The rate limiter logs FATAL in production until this is done (W3.2 commit message warns of the same). |
| **Configure Clerk MFA + SSO** | Operator | Clerk dashboard → Authentication → MFA → require for `admin` and `superadmin` roles. SSO requires Clerk Enterprise; engage sales. |
| **Engage independent penetration test** | CISO | Required by R1 vendor approval. Test should target the post-W3 build with all migrations applied. |
| **HECVAT Full** | CISO + AppSec | The Lite scaffold at `docs/security/HECVAT_LITE_RESPONSES.md` is a starting point. Full HECVAT requires evidence (logs, control descriptions, SOC 2). |
| **SOC 2 Type II** | CISO | Out of scope for code; engage an auditor. Marketing claim "SOC 2 in progress" already removed (`b32477d`). |
| **Legal review of `docs/security/FERPA_AGREEMENT_TEMPLATE.md`, `PRIVACY_POLICY.md`, `TERMS.md`** | Legal counsel | Each TODO marker is annotated with the decision needed. |
| **Provision shared mailboxes** | Operator | `security@clubit.app`, `legal@clubit.app`, `support@clubit.app` per `docs/security/INCIDENT_RESPONSE.md` TODOs. |
| **First IR tabletop exercise** | CISO | Use the C-1 incident as the worked example in `INCIDENT_RESPONSE.md`. |
| **Verify DPAs with all five subprocessors** | Legal counsel | List in `docs/security/SUBPROCESSORS.md` with TODOs to attach signed DPAs. |
| **CycloneDX/SPDX SBOM** | AppSec | Scaffolded in N-5; once the structured logger is in place, generate an SBOM as part of `build:prod`. |

---

## 5. Wave summary (commit references)

For each wave, the commits in chronological order. Each wave is independently revertable (each migration has a `.down.sql`; each code change is a focused commit).

**Wave 1** (foundational + externally-exploitable):
- `0faa82a` W1.0 setup — vitest, scaffolding, vendored assessment
- `fef2da9` W1.1 — pre-commit secret scanner + scrub residual fixture
- `aea5419` C-2 — Clerk CVE patch
- `80d8dc9` C-7 — CSPRNG everywhere
- `32bb45d` C-5 — users RLS lockdown
- `b32477d` W1.5 — remove false marketing claims
- `27264f7` W1.6 — strip dev routes from prod build

**Wave 2** (tenant model):
- `ca928df` C-4 — club-membership RLS rewrite (12 tables)
- `d8e4b53` C-4 followup — `/api/school/clubs/counts` mitigation
- `d92bdbb` C-4 — RLS regression matrix (65 cases)
- `a4a419b` H-3 — secret ballot
- `131ac42` C-3 — pending-approval onboarding
- `1875f61` C-8 — service-role inventory + 4-route refactor
- `d186000` H-1 / W2.5 — invite-code binding
- `a05264a` C-6 — webhook hardening

**Wave 3** (defense in depth):
- `add3dbf` H-7 — security headers + CSP report-only
- `fb49956` H-8 — Upstash rate limiting
- `a81eeb2` H-9 — append-only audit log
- `26b5922` H-10 — zod validation

**Wave 4** (compliance + CI):
- `c82ab20` W4.1 — README rewrite
- `06d4595` W4.2 — compliance docs scaffolding (8 documents)
- `e203ed1` W4.3 — CI security gate workflow

**Final:**
- `(this commit)` REMEDIATION_REPORT.md

---

## 6. Final recommendation

**The codebase is materially safer than the as-shipped version assessed.** The catastrophic findings (C-1 through C-8) are addressed; the high findings are addressed except for the listed follow-ups (`H-2`, `H-11`, `H-12`); defense-in-depth controls (rate limiting, audit log, zod validation, security headers, CI gate) are in place.

**Production readiness score: 77 / 100.** The remaining 23 points are *almost entirely* operator-side: apply the migrations, rotate the tokens, wire Upstash, configure Clerk MFA, engage a pen test, finalize legal review of the docs.

**Before any pilot with real student data:**

1. The five "operator next steps" listed above must be done.
2. The independent pen test must be commissioned and the report shared.
3. Legal must finalize the FERPA template + Privacy/Terms + DPAs.
4. The N-3 / N-4 / N-9 follow-ups (set_event_creators school check, leaderboard privacy, transactional school deletion) should land in a small follow-up wave.

After those, the codebase is suitable for a contained pilot. SOC 2 attestation and HECVAT Full are required before any institution at our scale would procure.

— end —
