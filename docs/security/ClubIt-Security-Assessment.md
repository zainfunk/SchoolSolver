# Vendor Security Assessment — ClubIt

**Vendor:** ClubIt (github.com/zainfunk/ClubIt)
**Assessor:** Senior InfoSec, R1 University
**Submission commit:** `0729417` (HEAD of `main`)
**Date of review:** 2026-04-25
**Methodology:** Full source review of `app/`, `lib/`, `supabase/`, `components/`, `types/`, `proxy.ts`, `next.config.ts`, `package.json`, `codemagic.yaml`, `.env.example`, full git history (all branches), and `npm audit` output.

---

## 1. EXECUTIVE SUMMARY

**Verdict: REJECT.**

This vendor is not safe to handle student data and is not close to production-ready. (1) A Clerk Backend API secret key is permanently committed in the public Git history at `tests/e2e/create-accounts.spec.ts:18` (commit `675af6f`) and is still in HEAD; treat it as a permanent compromise of the vendor's auth tenant. (2) The vendor's core authentication library, `@clerk/nextjs@7.0.11`, is affected by GHSA-vqx2-fgx2-5wq9 (CVSS 9.1, critical, route-protection bypass) — the vulnerability is unpatched in the submission. (3) The multi-tenant RLS model is dangerously over-permissive — every authenticated user in a school can read the contents of every club's chat messages, attendance, and election votes regardless of membership; combined with self-service school onboarding (`/api/onboard`) that auto-grants admin without identity verification, the platform is trivially weaponizable across schools and within a school.

---

## 2. CRITICAL FINDINGS

### C-1. Clerk Backend API secret committed to Git and still in HEAD
- **File:** `tests/e2e/create-accounts.spec.ts:18` (introduced by commit `675af6f`, "fix: route profile/override saves through API to bypass RLS, add E2E tests")
- **Evidence:**
  ```
  const CLERK_SECRET = 'sk_test_c8gPrS5RaekMmTA9dZwDBpbwgxuVhpguD5cp2gMSk9'
  ```
- **PoC:** Clone `https://github.com/zainfunk/ClubIt.git`. Read the file. Use the secret with the Clerk Backend API to: enumerate every user in the Clerk instance, mint sign-in tokens for any user (bypassing CAPTCHA + email verification — the comment in the file documents this attack path), update any user's `publicMetadata.role` to `superadmin`, and pivot from there into the entire Supabase database via the application's superadmin endpoints.
- **Impact:** Full takeover of the vendor's identity tenant. Every account, every PII record, every school. Rotation alone is not sufficient — the secret is in a public Git history and must be assumed already harvested. The `.env.local` in the working tree (untracked, but present) confirms the same secret is still active in the vendor's environment as of this review.
- **Remediation (vendor):** Rotate the Clerk secret immediately, scrub history (`git filter-repo`), force-push, audit Clerk audit logs for unauthorized API use, and conduct a forensic check of the Supabase project for unexpected role escalations. Even after that we cannot trust this tenant.

### C-2. Critical CVE in primary auth library — unpatched
- **File:** `package.json:19` declares `"@clerk/nextjs": "^7.0.11"`. `package-lock.json` resolves to a version `<7.2.1`.
- **Advisory:** GHSA-vqx2-fgx2-5wq9 — "Middleware-based route protection bypass," CVSS 9.1 (CWE-863, CWE-436). Affects `>=7.0.0 <7.2.1`.
- **Impact:** The Clerk middleware (`proxy.ts:22-41`) is the only thing standing between unauthenticated traffic and every authenticated route. The CVE allows attackers to bypass that middleware entirely, reaching protected pages and API routes without a valid session. Combined with C-1 it is a complete authentication failure.
- **Remediation:** This is a known, patchable issue. The fact that the vendor is shipping it for evaluation indicates no dependency-monitoring discipline.

### C-3. Self-service school registration auto-grants admin to anyone
- **File:** `app/api/onboard/route.ts:33-83`
- **Behavior:** Any authenticated Clerk user can `POST /api/onboard` with `{name, district, contactName, contactEmail}`. The route immediately:
  1. Creates a `schools` row with `status = 'active'`,
  2. Generates the three invite codes,
  3. Upserts `users.role = 'admin'` and `users.school_id = <new>` for the caller,
  4. Updates Clerk `publicMetadata.role = 'admin'`.
- **No email-domain validation, no human review, no out-of-band verification.** The route trusts the form fields entirely and ignores `clerkUser.primaryEmailAddress` for verification.
- **PoC:** A student creates an account with any email. They submit `{name: "University High School", contactEmail: "principal@university.edu"}`. They are now the admin of "University High School" inside ClubIt — they can pull rosters, fabricate elections, post to chat as "the school," and exfiltrate any data later joined to that tenant. Real University High students who later join the platform via SSO would land in this attacker-controlled tenant.
- **Impact:** Tenant impersonation; school-name squatting; potentially FERPA-violating data ingestion into an attacker-controlled tenant. The `superadmin` panel can suspend after the fact (`/api/superadmin/schools/[id]/suspend`) — but the data is already exposed by then.

### C-4. Cross-club data exposure inside a tenant via RLS policies
- **File:** `supabase/schema.sql:545-558` (`app.club_in_scope`) and the policies that depend on it: `chat_messages_select` (line 991-994), `attendance_records_select` (847-850), `events_select` (833-836), `club_news_select` (901-904), `polls_select`, `poll_candidates_select`, `poll_votes_select`, `meeting_times_select`, `leadership_positions_select`, `club_social_links_select`, `attendance_sessions_select`, `memberships_select`, `join_requests_select`, `club_forms_select`.
- **Behavior:** `app.club_in_scope(target_club_id)` returns true if the club's `school_id` matches the caller's `school_id`. **It does not check membership.** Therefore every authenticated user in school X can `SELECT *` from:
  - `chat_messages` for every club in school X (private DMs between leaders, sensitive disciplinary discussions, etc.),
  - `attendance_records` (every student's attendance for every club in the school),
  - `attendance_sessions` (including advisor GPS coordinates `advisor_lat`/`advisor_lng`),
  - `events` even where `is_public = false`,
  - `poll_votes` (with both `voter_user_id` and `candidate_user_id` — i.e., **non-secret votes that any classmate can read**),
  - `election_votes` (same problem at school-wide elections — `election_votes_select` at line 978-981 makes votes visible to all),
  - `club_news`, `club_forms`, `form_responses` (every form response, regardless of who submitted),
  - `memberships` and `join_requests` (every roster, every pending request, every rejection).
- **PoC:** A student at school X authenticates and runs (via the supabase-js client that ships in the app):
  ```js
  await supabase.from('chat_messages').select('*')
  await supabase.from('election_votes').select('*')
  await supabase.from('attendance_sessions').select('advisor_lat, advisor_lng, recorded_user_ids')
  ```
  They receive everything for the entire school.
- **Impact:** Catastrophic privacy failure. Compromises ballot secrecy in every school using `school_elections` or `polls`. Exposes private faculty-to-faculty chat. Leaks advisor location data. This is the kind of bug that becomes a Title IX, FERPA, and election-integrity story simultaneously.

### C-5. Self-promotion via direct DB insert (RLS gap)
- **File:** `supabase/schema.sql:718-721`
  ```sql
  create policy users_insert_self on users
    for insert to authenticated
    with check (id = app.current_user_id());
  ```
- **Behavior:** The check constraint on `users.role` (line 425-426) allows any of `superadmin`, `admin`, `advisor`, `student`. The RLS policy only verifies the `id` column matches the caller — it does **not** restrict `role` or `school_id`. Combined with the client-side anon key + Clerk-JWT bridge, an authenticated student who has not yet been provisioned in `users` can insert their own row with `role = 'superadmin'` and `school_id = <any school>`.
- **PoC:** New Clerk user signs up via `/sign-up`, never visits `/join`, opens devtools, and runs:
  ```js
  await supabase.from('users').insert({
    id: clerkUserId, name: 'X', email: 'x@x',
    role: 'superadmin', school_id: '<victim school uuid>'
  })
  ```
  RLS allows the insert (id matches `auth.jwt()->>'sub'`). Subsequent calls to `/api/superadmin/*` then succeed because `requireSuperAdmin()` in routes such as `app/api/superadmin/schools/route.ts:6-25` consults the `users.role` column first.
- **Impact:** Privilege escalation from any new account to superadmin of the entire platform. There is no `users_update` policy, so changing role after the fact requires the service role — but the **insert path** is the bypass, and as soon as `/api/user/sync` is later called by the application it will trust the now-existing `users` row.

### C-6. Stripe webhook accepts unsigned events when `STRIPE_WEBHOOK_SECRET` is unset
- **File:** `app/api/webhooks/stripe/route.ts:22-33`
  ```ts
  if (webhookSecret) { /* verify */ } else {
    // In dev without a webhook secret, parse the event directly (NOT safe for production).
    event = JSON.parse(body) as Stripe.Event
  }
  ```
- **Behavior:** This route is whitelisted as public in `proxy.ts:18`. The vendor ships **two** webhook handlers: `app/api/webhooks/stripe/route.ts` (this one, broken) and `app/api/stripe/webhook/route.ts` (verifies signatures correctly). Both update `schools` rows. If `STRIPE_WEBHOOK_SECRET` is unset in production (a deployment-time mistake — and there is no startup check), this endpoint will accept any forged payload from the public internet.
- **PoC:** `curl -X POST https://clubit.vercel.app/api/webhooks/stripe -d '{"type":"customer.subscription.updated","data":{"object":{"customer":"cus_X","status":"active"}}}'` — the route runs `db.from('schools').update({stripe_subscription_status:'active'}).eq('stripe_customer_id','cus_X')`, reactivating any school whose customer ID the attacker can guess or scrape.
- **Impact:** Subscription bypass / financial fraud / forced reactivation of suspended (e.g., compliance-flagged) schools. The presence of two webhook handlers also indicates dead-code rot — a sign the codebase isn't being maintained with security in mind.

### C-7. Predictable invite codes and setup tokens (`Math.random()`)
- **File:** `lib/schools-store.ts:5-19`
  ```ts
  function randomSegment(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    ...
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  export function generateInviteCode(prefix) { return `${randomSegment(4)}-${prefix}-${randomSegment(4)}` }
  export function generateSetupToken() { return `${randomSegment(6)}-${randomSegment(6)}-${randomSegment(6)}` }
  ```
- **Behavior:** All invite codes (student/admin/advisor) and the one-time setup-link tokens are derived from `Math.random()`. V8's `Math.random()` is xorshift128+ — non-cryptographic and well-known to be reverse-engineerable from a small number of observed outputs from the same process. Any superadmin or onboarding API call that reveals a generated code (`/api/superadmin/schools/[id]/regenerate-codes`, `/api/onboard`, `/api/setup/[token]`) leaks state that an attacker can use to predict subsequent codes for other schools generated by the same Node process.
- **PoC:** Attacker registers their own school via `/api/onboard` (see C-3), receives the three returned invite codes, and uses them to seed a `Math.random()` predictor (e.g., the well-known V8 xorshift128+ inversion). Predicts the next school's setup token. Visits `/setup/<predicted-token>` — that route requires no authentication (`proxy.ts:17` allows `/api/setup/(.*)` and `/setup(.*)` publicly) and returns the school's three invite codes, which then let the attacker join that real school as **admin** via `/api/join`.
- **Impact:** Cross-tenant compromise via token prediction. The setup link is the high-value target because it has no authentication and is the single carrier for the admin invite code.

### C-8. Service-role key used in every API route — RLS is decorative
- **File:** `lib/supabase.ts:22-25`; used by ~30 routes including `app/api/school/clubs/[id]/route.ts`, `app/api/onboard/route.ts`, `app/api/join/route.ts`, etc.
- **Behavior:** Every route handler calls `createServiceClient()` which uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS entirely. Authorization is then re-implemented per-route in TypeScript, with frequent inconsistencies — e.g., `requireSuperAdmin` in `app/api/superadmin/schools/route.ts:6-25` checks DB then Clerk; the same function in `app/api/superadmin/schools/[id]/setup-link/route.ts:6-13` checks **only** Clerk metadata. Same name, different semantics. These drift between routes and audits.
- **Impact:** RLS becomes a paper tiger. Any forgotten check in any route is an authorization bypass. There is no compensating control — a single missing `school_id` filter on a service-role query exposes data across tenants. Examples observed:
  - `app/api/checkout/route.ts:8-44` — does not verify caller is admin; any authenticated user can initiate a $500/yr Stripe checkout for any school they can name in metadata.
  - `app/api/school/billing/route.ts:19` — explicitly excludes `superadmin` (only allows `role !== 'admin'` to fail), so superadmins cannot view billing — minor, but indicative.

---

## 3. HIGH FINDINGS

### H-1. Role escalation via `/api/join` re-submission
- **File:** `app/api/join/route.ts:67-115`
- **Behavior:** When an existing user submits the **admin** invite code, the route upserts `users.role = 'admin'` for them — it only blocks the case where the user is already in a *different* school. A student who obtains the school's admin code (one accidental email forward, one student-leader's iPad) becomes admin, and the attack is replayable indefinitely until the code is rotated. The codes are not bound to email or identity.
- **PoC:** Student joins School X as `student`. Later obtains the admin code (rotation is manual; codes are durable). `POST /api/join {code: '<admin-code>'}` → student is now admin.
- **Impact:** Single-credential, school-wide admin compromise. Codes are also displayed in the Admin UI to anyone who has already joined as admin — no "view-once" mechanism.

### H-2. Display-name spoofing via `user_overrides`
- **File:** `app/api/user/overrides/route.ts:24-63`; rendered by `app/api/school/clubs/[id]/route.ts:199-215` (and by every component that pulls `usersById`).
- **Behavior:** A user can `PATCH /api/user/overrides` with `{name, email}` of their choosing. The override is then rendered as the canonical name/email everywhere — chat messages, club rosters, admin user lists, election candidate lists. `sanitizeText` strips `<>` but does not prevent a student from changing their displayed name to "Principal Hayes" with an `@school.edu` email.
- **Impact:** Impersonation of staff in chat, fake quotes attributed to admins, social-engineering inside the platform. The RLS allows any user to manage their own override (`user_overrides_manage` policy at line 1068-1084).

### H-3. Polls and elections are not anonymous
- **File:** Schema lines 134-139 (`poll_votes`), 156-161 (`election_votes`), policies at 937-940 and 978-981. Application reads at `app/api/school/clubs/[id]/route.ts:72` and `app/api/school/elections/route.ts:62-63`.
- **Behavior:** The vote tables explicitly store `voter_user_id` next to `candidate_user_id`. The select policies expose those rows to every authenticated user in the school. The API routes return `{candidateUserId, voterUserId}` arrays.
- **Impact:** No ballot secrecy. Schools running student-government elections through ClubIt would be in violation of common student-government bylaws and basic election integrity expectations. This is also a retaliation vector (a leader can see who voted against them).

### H-4. Cross-club poll voting (membership not enforced server-side)
- **File:** `app/api/school/clubs/[id]/route.ts:482-490` (`cast_poll_vote` action)
  ```ts
  const { count } = await db.from('poll_votes')...
  if ((count ?? 0) === 0) {
    await db.from('poll_votes').insert({ poll_id: pollId, candidate_user_id: candidateUserId, voter_user_id: userId })
  }
  ```
- **Behavior:** No check that the voter is a member of the poll's club, no check that the poll is `is_open`, no check that `candidateUserId` is a candidate. The RLS policy `poll_votes_insert` (line 942-954) does check membership — but the route uses the service role and bypasses it.
- **Impact:** Stuffing of club leadership votes by non-members, including the candidate themselves.

### H-5. `/api/dev/school-lab` is gated only by `NODE_ENV` — no role check
- **Files:** `app/api/dev/school-lab/route.ts:19-25, 94-244`; UI at `app/dev/school-lab/school-lab-client.tsx`.
- **Behavior:** When `NODE_ENV === 'development'`, any authenticated user can: `create_test_school` (becoming its admin), `set_my_role` to `student`/`advisor`/`admin`, regenerate codes, generate new setup links, change school status. The route does not verify that the caller is a superadmin. The page is whitelisted in `mock-auth.tsx:43-44` (`/dev` is in `NO_SCHOOL_REQUIRED`).
- **Impact:** Any preview deployment, staging environment, or production with a misconfigured `NODE_ENV` becomes a privilege-escalation portal for any signed-in user. Codemagic config (`codemagic.yaml`) and `next.config.ts` do not pin `NODE_ENV=production` explicitly.

### H-6. `/api/setup/[token]` is unauthenticated and leaks all three invite codes
- **File:** `app/api/setup/[token]/route.ts:5-41`; `proxy.ts:17` whitelists `/api/setup/(.*)`.
- **Behavior:** Anyone with the token can `GET` the school's `student_invite_code`, `admin_invite_code`, `advisor_invite_code`, contact name, contact email. There is no link click-counter, no authentication, no rate limit, no IP binding. The token is the only thing protecting the school's full set of invite codes — and the token is generated from `Math.random()` (C-7).
- **Impact:** A leaked or predicted setup URL turns into permanent admin access (the codes don't auto-rotate).

### H-7. No security headers; no CSP
- **File:** `next.config.ts:1-5` is empty (`const nextConfig: NextConfig = {}`). No `headers()` callback, no CSP, no HSTS, no X-Frame-Options, no X-Content-Type-Options, no Referrer-Policy, no Permissions-Policy.
- **Impact:** Default Vercel/Next behaviour only. No defense-in-depth against XSS (and React's escaping is the only XSS line of defense), clickjacking, MIME sniffing, or referrer leakage. For an EDU vendor handling minor PII, this is below floor.

### H-8. Effectively no rate limiting
- **File:** `lib/rate-limit.ts`
- **Behavior:** In-memory `Map<string, RateLimitEntry>` with 5 attempts per 60-second window keyed by `x-forwarded-for`. Used only at `app/api/join/route.ts:13`. On Vercel (the documented hosting target — `codemagic.yaml:16`), each invocation can land on a separate isolate; the Map is **not shared across instances**. There is no rate limiting on `/api/onboard`, `/api/checkout`, `/api/user/profile`, `/api/user/overrides`, `/api/setup/[token]`, `/api/superadmin/*`, or any other route. The IP-only key allows `X-Forwarded-For` spoofing in any environment that doesn't strip headers (Vercel does, but the vendor cannot rely on that).
- **Impact:** Brute-force of invite codes is trivial. Setup-link probing is unconstrained. There is no detection or alerting on excessive failures.

### H-9. `users_update` not protected — admin role changes via API trust the client role string
- **File:** `app/api/school/users/[id]/role/route.ts:30-94`
- **Behavior:** Admin in school X can flip any user's role to any of `student/advisor/admin` via `POST {role: 'admin'}`. No audit log. No notification to the demoted user. No "minimum two admins to demote yourself" check beyond a count >= 1 (line 78 — exactly 1 is allowed to demote, leaving 0 admins for the school after self-promotion of someone else).
- **Impact:** A compromised or rogue admin can silently appoint an attacker as co-admin and demote real staff. No audit trail.

### H-10. Mass-assignment / unsanitized JSON in profile `socials`
- **File:** `app/api/user/profile/route.ts:66-75`
- **Behavior:** `socials: body.socials !== undefined ? body.socials : ...` — the JSONB blob is written verbatim. No schema, no sanitization, no URL validation, no protocol restriction. `lib/sanitize.ts` handles strings; this field is opaque JSON.
- **Impact:** Stored attack payloads inside profile JSON. While there's no `dangerouslySetInnerHTML` today, the field is rendered as `<a href={s.url}>` on `app/profile/page.tsx:403` and `app/profile/[id]/page.tsx:465`. A `javascript:` URL in `socials[].url` is not blocked at write time and depends on browser handling and React's `href` heuristics. Add `data:` and `vbscript:` to the threat list.

### H-11. Schools `DELETE` cascade leaks orphans
- **File:** `app/api/superadmin/schools/[id]/route.ts:62-121`
- **Behavior:** Deletion runs ~13 sequential best-effort `DELETE`s without a transaction. Mid-failure leaves the DB in inconsistent state. Clubs are selected by `advisor_id IN (school_users)` — clubs whose `school_id = X` but whose advisor was unset or assigned to a non-school user are **never deleted** (line 81-86). User rows are not deleted (per the comment), but `chat_messages.sender_id` references those users; if a user later joins another school, their old messages still appear as theirs.
- **Impact:** Data inconsistency, orphan rows; potential for FERPA-relevant data to remain after a deletion request that the vendor would represent as fulfilled.

### H-12. Event creators bypass member-creator check inconsistently
- **File:** `app/api/school/clubs/[id]/route.ts:438-444` (`create_event`)
- **Behavior:** `isEventCreator = isManager || event_creator_ids.includes(userId)`. There's no check that the user is in scope for the school. Combined with the service-role bypass and the missing `school_id` constraint on `event_creator_ids`, an admin elsewhere who somehow lands a user-id into another school's `event_creator_ids` array (mass-assignment in `set_event_creators` doesn't validate the IDs belong to the school) gains the ability to insert events and news in that other club.

---

## 4. MEDIUM FINDINGS

### M-1. Direct client-side Supabase reads bypass server validation
- `app/admin/page.tsx:52-71` and `app/dashboard/page.tsx:67` call `supabase.from('users')`, `supabase.from('memberships')`, `supabase.from('issue_reports')` directly with the anon key and Clerk JWT. The RLS policies as written allow these reads (per C-4). There is no defense in depth.

### M-2. Two competing webhook handlers
- `app/api/webhooks/stripe/route.ts` (broken — see C-6) and `app/api/stripe/webhook/route.ts` coexist. Both update `schools` and/or `subscriptions` on overlapping events. Stripe will deliver to whichever URL the dashboard is configured for, but if both are reachable, replay/forgery against the broken one corrupts state visible to the new one.

### M-3. Realtime subscriptions reflect the over-permissive RLS
- `lib/realtime.ts:52-94` subscribes to `chat_messages`, `memberships`, `join_requests` postgres-changes broadcasts using the school-wide RLS view from C-4. Every user in a school receives a real-time push of every chat message in every club. Privacy issue is real-time, not just on-fetch.

### M-4. Leaderboard ignores user privacy preferences
- `app/api/school/leaderboard/route.ts:78-104`: returns `{userId, name, totalMinutes, xp, longestStreak}` for every student in the school, regardless of `user_privacy_settings.achievements_public`. The UI privacy toggle is therefore non-functional.

### M-5. No MFA, no SSO, no Shibboleth/SAML
- The submission relies on Clerk's hosted password sign-in + email/social. There is no SSO, no SAML/Shibboleth integration, no MFA enforcement. For an EDU vendor proposing to handle student data, no SSO means no identity assurance from the institution and no centralized off-boarding.

### M-6. No account lockout, no password-reset rate limiting at the app layer
- All sign-in/sign-up traffic flows through Clerk's hosted UI; the app does not configure or document Clerk policies (lockout threshold, breach detection, MFA requirement). Whatever the Clerk default is, the institution can't see or audit it.

### M-7. Logging via `console.error` only
- Every error path is `console.error('...', err)`. On Vercel that becomes Function Logs — ephemeral, no structured fields, no correlation IDs, no PII redaction. There is no SIEM integration, no audit log of admin actions, no anomaly alerting.

### M-8. `proxy.ts` whitelist is broad
- `proxy.ts:13` lists `/join` (no wildcard) and `/onboard(.*)`. The route `/api/onboard` is also wholly public. Any sloppy whitelist-pattern addition (e.g., `/api/(.*)`) would be silent.

### M-9. `setInterval` cleanup timer in Edge runtime is fragile
- `lib/rate-limit.ts:17-27` calls `setInterval(...)` at module load. In a serverless invocation model this either never fires or pins the isolate. Either way, the rate-limiting state is unreliable.

### M-10. No CSRF defense documented
- API routes accept JSON via `fetch` from the same origin. Clerk's session cookies are SameSite=Lax by default in modern browsers, but the vendor does not configure or document CSRF protection at the route layer (no double-submit, no SameSite=Strict for sensitive endpoints, no `Origin` header check). For state-changing GETs (none observed, but easy to introduce) this is undefended.

### M-11. `manifest.ts` `start_url` = `/dashboard`
- A PWA install pointed at `/dashboard` returns the Clerk redirect for unauthenticated callers, which is acceptable but worth flagging — make sure it doesn't end up in browser caches with auth state.

### M-12. Stripe customer email comes from `users.email`, which can be overridden
- `app/api/stripe/checkout/route.ts:13-37`: `customer_email: userRow?.email`. That field can be edited via `/api/user/overrides` (H-2). A user setting their override to someone else's email may end up on someone else's Stripe customer record.

### M-13. CORS is undefined; `Origin` is not validated
- No explicit CORS config in `next.config.ts`. Default Next.js sets `Access-Control-Allow-Origin: *` for some asset paths. The vendor does not lock down which origins may call the API.

### M-14. Capacitor iOS shell increases the surface
- `capacitor.config.ts` and `codemagic.yaml` ship the same web app inside an iOS WKWebView. Any vulnerability in the web app is now also a native-app vulnerability. There is no native-side defense (cert pinning, jailbreak detection, secure-keystore-backed token storage) documented.

---

## 5. LOW FINDINGS & HYGIENE

- **L-1.** Schema mixes `text` IDs (Clerk-derived) with `uuid` (e.g., `schools.id`). Inconsistent, error-prone joins.
- **L-2.** No DB migrations directory — `supabase/schema.sql` is a single 1,229-line file with retrofit `alter table` blocks and `drop policy if exists ... create policy` patterns. No migration history, no rollback path.
- **L-3.** `supabase/schema.sql:421` declares `add column if not exists school_id` on `admin_settings` twice (lines 415 and 421).
- **L-4.** `tests/e2e/create-accounts.spec.ts` documents that the test path bypasses CAPTCHA and email verification using the (now-leaked) Clerk secret. Indicates email verification is not enforceable from the application layer.
- **L-5.** Empty `next.config.ts` means no image-domain allowlist for `next/image`. Not actively exploited but a hardening miss.
- **L-6.** README.md is the unchanged Next.js scaffold — no security contact, no responsible disclosure policy, no SLA.
- **L-7.** `app/api/superadmin/invite/route.ts` is dev-only but the `InviteModal` UI element is conditional on the same flag — a stale `NODE_ENV` will expose it in the superadmin panel without further review.
- **L-8.** Idempotency key for memberships is `m-${requestId}` (`app/api/school/clubs/[id]/route.ts:291`); deterministic from request id, fine — but `id: msg-${Date.now()}-${Math.random().toString(36).slice(2,8)}` for chat messages is non-cryptographic (acceptable for IDs, flagged for awareness).
- **L-9.** `supabase/schema.sql:411-412` adds `school_id` to `users` as nullable. A misconfigured user with `school_id = null` cascades into "no school context" rather than a denial — soft-fail on a security-relevant field.
- **L-10.** `eslint.config.mjs` disables nothing of security relevance — but no `eslint-plugin-security` is in use; no static analysis CI step is documented.

---

## 6. MISSING CONTROLS

The following controls are absent, undocumented, or non-functional. Any one would normally be a non-starter for an EDU vendor:

- **MFA enforcement** for admins/advisors. Not configured.
- **SSO / SAML / Shibboleth / Google Workspace federation.** Not present.
- **Account lockout policy** at the app layer.
- **Audit logs** for: admin role changes, invite-code rotations, school suspensions, deletions, profile overrides, election creation, vote casts. None.
- **Tenant-side admin notifications** for new admin grants. None.
- **Backup / DR plan, restore testing.** Not documented; relies on Supabase defaults.
- **Incident response plan, breach notification SLA.** Not documented.
- **Rate limiting** at the network or platform layer. Not configured.
- **WAF / bot protection.** Not configured beyond default Vercel.
- **Security headers / CSP.** Not configured.
- **Data deletion / export endpoints** for student/parent data subject requests. The closest analog is `DELETE /api/superadmin/schools/[id]` (H-11), which is destructive and not auditable.
- **PII inventory or DPIA.** Not documented.
- **Vendor security contact.** Not documented.
- **Penetration test.** No evidence of one.
- **Dependency-monitoring / SBOM.** Failed; ships C-2.

---

## 7. COMPLIANCE GAP ANALYSIS

### FERPA
- **Educational records covered:** chat messages, club rosters, attendance, election votes, hours tracking, badges, leadership history. All qualify as "education records" under 34 CFR § 99.3 once the platform handles real students.
- **Specific gaps:**
  - **34 CFR § 99.31(a)(1)(i)(B) "school official" exception** is the only viable basis. The vendor's data handling is not constrained to "legitimate educational interests" — every student in a school can read every other student's attendance and vote history (C-4). This exceeds the directory-information exception and exceeds the school-official exception.
  - **No mechanism for parents/eligible students to inspect or amend records** (§ 99.10).
  - **No annual notification or right-to-opt-out documented.**
  - **No audit log** of disclosures (§ 99.32). FERPA explicitly requires the institution to maintain a record of every party that requested or obtained access — this codebase produces none.
  - **No written agreement template** between the institution and the vendor restricting the vendor's data use to the contracted purpose.
- **Verdict:** FERPA-incompatible as shipped. The "school official" exception requires the school to have direct control over the vendor's use of records. C-1, C-3, C-4, and the lack of audit logs make that contractually un-attestable.

### COPPA
- The platform has **no age gate**. Middle-school clubs (`memberships`, etc.) routinely include under-13 users. Without verifiable parental consent and parent-facing controls, COPPA exposure is real. The vendor does not advertise an age check or parental-consent workflow.

### HECVAT Lite — sections this vendor would fail
- **HLDP (High-Level Documentation):** No SDLC, no security policy, no IR plan, no DR plan, no SOC 2, no HECVAT itself, no penetration test results. Fail.
- **APPL (Application Security):** Vulnerable dependency (C-2), broken authn/authz (C-1, C-3, C-5), no CSP/security headers (H-7), client-side direct DB access (M-1). Fail.
- **AUTH (Authentication, Authorization, Accounting):** No MFA, no SSO, no account-lockout policy, no audit logs, role-management endpoint without auditing (H-9). Fail.
- **DATA (Data):** Catastrophic cross-tenant/cross-club exposure (C-4), non-secret elections (H-3), no encryption-in-transit attestations beyond Vercel/Supabase defaults, no data-classification doc, no DLP. Fail.
- **HRPI (HR / Personnel):** Not addressed; vendor is presumably one developer based on git history (one author).
- **THRD (Third Parties):** Vendor uses Clerk, Supabase, Stripe, Vercel — no documented vendor-management program, no sub-processor list. Fail.
- **TPVD (Third-Party Validation):** No external assessments. Fail.
- **CHNG (Change Management):** No migration system, no audited release process, two competing Stripe webhook handlers (M-2). Fail.

### SOC 2
- "SOC 2 in progress" claim (per the prompt) is **unverifiable from this submission**. There is no evidence of access reviews, change-management, vulnerability-management, or vendor-management controls. C-1 alone would be a critical issue any SOC 2 auditor would raise as a control failure that has not been remediated.

### "End-to-end encrypted" marketing claim
- **False.** Chat messages are stored as plaintext in `chat_messages.content` (`supabase/schema.sql:163-170`) and read in plaintext by RLS policies that include the entire school. There is no client-side encryption, no key management, nothing that remotely resembles E2EE. Any such claim on the vendor's marketing site is a misrepresentation.

---

## 8. PRODUCTION READINESS SCORE

| Category | Score | Notes |
| --- | --- | --- |
| Authentication | **2 / 10** | Critical CVE in primary auth library (C-2), leaked secret (C-1), no MFA/SSO. |
| Authorization | **2 / 20** | RLS over-permissive (C-4); service-role bypass everywhere (C-8); self-promotion (C-5); IDOR-style (H-1, H-9). The most important category, and the worst-performing. |
| Data protection | **3 / 15** | No E2EE despite claim; leaderboard ignores privacy flags (M-4); no encryption beyond defaults; no audit logs. |
| Input validation | **5 / 10** | `sanitizeText`/`sanitizeUrl` exist but inconsistent; mass-assignment on `socials` (H-10); no schema validation library (Zod, etc.) used. |
| Secrets management | **0 / 10** | C-1 alone forces this to zero; `Math.random()` for tokens (C-7). |
| Dependency hygiene | **1 / 5** | Critical CVE shipped (C-2), additional moderate CVEs in Hono transitive deps. |
| Logging & monitoring | **1 / 10** | `console.error` only; no audit log; no monitoring; no alerting. |
| Compliance documentation | **0 / 10** | None of FERPA, COPPA, SOC 2, HECVAT documented. |
| Operational maturity | **2 / 10** | One author in git history; single-file SQL "migrations"; two competing webhook handlers; no CI security gate. |

**Total: 16 / 100.**

---

## 9. CONDITIONS FOR APPROVAL

The vendor must, at minimum, complete every item below before we will reopen evaluation. Items are listed in priority order. None are negotiable.

1. **Rotate the Clerk secret leaked at `tests/e2e/create-accounts.spec.ts:18` (commit `675af6f`).** Scrub it from history with `git filter-repo`, force-push to all remotes, and produce Clerk audit-log evidence covering at minimum the period from `675af6f`'s commit date to the rotation showing no unauthorized API use. Provide written incident report to the university CISO. Do the same for the live keys present in `.env.local`.
2. **Upgrade `@clerk/nextjs` to >= 7.2.1** to remediate GHSA-vqx2-fgx2-5wq9. Provide the resulting `npm audit --omit=dev` report with zero high/critical findings. Add Dependabot or Renovate with required-merge enforcement.
3. **Replace `Math.random()` with `crypto.randomBytes()` in `lib/schools-store.ts`** for invite codes (>= 64 bits of entropy, not derived from a predictable PRNG) and setup tokens (>= 128 bits). Migrate existing tokens.
4. **Re-architect RLS** so that `chat_messages`, `attendance_records`, `attendance_sessions`, `events` (when `is_public=false`), `club_news`, `polls`, `poll_candidates`, `poll_votes`, `meeting_times`, `leadership_positions`, `club_social_links`, `memberships`, `join_requests`, `club_forms`, `form_responses`, and `election_votes` are visible only to club members (and managers/advisors), not to the entire school. Concretely: replace `app.club_in_scope(club_id)` with `app.club_member(club_id, app.current_user_id())` for SELECT on every membership-private table.
5. **Make votes secret.** Drop `voter_user_id` from the SELECT projection and the policy USING clauses for `poll_votes` and `election_votes`. Replace with a per-poll/per-election "has voted" boolean derivable without identity disclosure.
6. **Lock down `users` insert/update RLS.** `users_insert_self` must include `with check (id = app.current_user_id() and role in ('student') and school_id is null)`. Add `users_update` policy that forbids self-promotion and forbids the role/school_id columns from being changed by the user.
7. **Replace self-service `/api/onboard`** with one of: (a) explicit superadmin approval before activation, (b) verified DNS-TXT or email-domain validation tying `contact_email` to the claimed school. Onboarding admins must be verified out-of-band before `users.role = 'admin'` is granted.
8. **Stop bypassing RLS in API routes.** Routes must use a per-request anon client carrying the Clerk JWT, and RLS must be the authorization source of truth. Service-role usage must be documented per call site with a written justification and a code review tag.
9. **Delete `app/api/webhooks/stripe/route.ts`.** Keep only `app/api/stripe/webhook/route.ts`. Add a startup check that fails the build if `STRIPE_WEBHOOK_SECRET` is unset in production.
10. **Bind invite codes to identity.** Add expiry (<= 7 days), one-time-use semantics, and email or domain binding. Rotate all currently active codes on every admin role grant.
11. **Disable the `/api/dev/school-lab`, `/dev/school-lab`, and `/api/superadmin/invite` dev-only paths** by removing them from the deployed bundle (e.g., feature-flag at build time, not runtime), and add a CI check that production builds reject any route gated on `NODE_ENV === 'development'`.
12. **Add security headers** in `next.config.ts.headers()`: a strict `Content-Security-Policy`, `Strict-Transport-Security` with `preload`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera/mic/geolocation by default. Provide CSP report-uri for one quarter to validate.
13. **Implement persistent rate limiting** (Upstash Ratelimit, or DB-backed) on `/api/onboard`, `/api/join`, `/api/setup/[token]`, `/api/checkout`, `/api/user/profile`, `/api/user/overrides`, `/api/superadmin/*`, and authentication endpoints. Per-user and per-IP buckets.
14. **Implement audit logging** for: every admin role change, invite-code rotation, school status change, school deletion, profile-override change, election creation, vote cast, suspension, and webhook processing. Logs must be append-only and exportable.
15. **Enforce MFA for `admin` and `superadmin` roles** at the Clerk policy layer, and **commit to SSO/SAML support** with Google Workspace, Microsoft Entra ID, or Shibboleth before pilot.
16. **Validate `socials` JSONB shape and URL protocol** server-side (Zod schema, http(s) only). Re-run sanitization on read.
17. **Provide a written FERPA "school official" agreement template** restricting the vendor's use of education records to the contracted purpose, prohibiting redisclosure, and requiring deletion or return on contract termination.
18. **Provide a written incident response plan** with breach-notification SLAs that are at least as strict as our institutional standard (24h initial notice, 72h written report).
19. **Complete a HECVAT Full** (not Lite) and submit. Engage a third-party penetration test against the remediated build and submit the report.
20. **Add an age gate** and a parental-consent workflow before any users under 13 are onboarded; or contractually exclude under-13 users.

---

## 10. FINAL RECOMMENDATION

**Reject.** Do not sign. Do not pilot. Do not allow any test data — including synthetic data — to be uploaded to the vendor's current Supabase project (`https://eijveyyvjyakfqaofgwe.supabase.co`), since C-1 means the auth tenant guarding it must be assumed compromised.

The vendor may reapply after the conditions in §9 are satisfied **and** an independent third-party penetration test against the remediated build is shared with us. Even then, the architectural decision to bypass RLS in every server route (C-8) will require either a fundamental rewrite or a written, point-by-point demonstration that every server route correctly enforces the tenant boundary that RLS currently does not.

This codebase shows the hallmarks of a fast-moving solo developer using AI-assisted code generation (commit messages co-author Claude Sonnet/Opus on the most security-sensitive changes — onboarding flow, RLS rewrite, profile/override routes, Stripe integration). That is not a disqualifier on its own, but it correlates with the patterns observed: confident-looking code, missing threat modeling, copy-pasted authorization helpers that drift, and the same secret committed in production code paths and test fixtures. An R1 with student PII is not the right place for that risk profile.

---

**End of report.**
