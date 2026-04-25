# ClubIt Incident Response Plan

This is the runbook for security incidents affecting ClubIt production.
It is a scaffold — every section marked TODO must be filled in by the
business / security owner before the document can be relied on under
pressure.

## Roles

- **Incident Commander (IC):** drives the response, owns the timeline,
  decides when to escalate or close. <!-- TODO(business): name primary + secondary IC. -->
- **Security Lead:** triages technical evidence, signs off on
  remediation. <!-- TODO(business): name. -->
- **Comms Lead:** drafts customer + regulator communications. <!-- TODO(business): name. -->
- **Engineering on-call:** ships fixes, runs migrations, rotates secrets.
  <!-- TODO(business): name + on-call schedule URL. -->

## Contact channels

- **Pager / page-the-on-call:** <!-- TODO(business): PagerDuty service URL or equivalent. -->
- **Internal incident channel:** <!-- TODO(business): Slack / Discord / Teams channel. -->
- **External security mailbox:** `security@clubit.app` (alias to <!-- TODO(business): list of human inboxes -->).
- **Status page:** <!-- TODO(business): URL or "no status page yet". -->
- **Vendor support:** Vercel, Supabase, Clerk, Stripe — log in with the
  ops account and open a P1 ticket; account credentials live in the team
  password manager. <!-- TODO(business): document password manager and break-glass account. -->

## Severity definitions

| Severity | Definition | Initial response | Examples |
|---|---|---|---|
| **S0** | Active or imminent compromise of production data, secrets, or tenant isolation. | Page IC + Security Lead within 15 min. All hands. Comms drafted in parallel. | C-1 secret leak; live RLS bypass exposing student PII; verified Supabase compromise. |
| **S1** | Confirmed vulnerability that an external actor could exploit, but exploitation not yet observed. | Page IC within 1 hour. Hot-fix path; emergency deploy. | Critical CVE in a deployed dependency; webhook accepting unsigned events. |
| **S2** | Vulnerability requiring authenticated access or specific conditions; no evidence of exploitation. | Triage in business hours; targeted fix in current sprint. | Privilege-escalation requiring an authenticated account; missing rate limit. |
| **S3** | Hardening gap, hygiene issue, low-impact misconfiguration. | Backlog with owner + due date. | Missing security header; verbose error message. |

## Breach-notification SLAs

ClubIt handles education records subject to FERPA. While FERPA itself
imposes notification obligations primarily on the educational institution
(the LEA), our school-official agreement (`FERPA_AGREEMENT_TEMPLATE.md`)
commits us to notify the institution at least as fast as their own
internal SLA. Our defaults:

- **Initial notice to affected institution(s): within 24 hours** of
  classifying the event as a confirmed S0 or S1 involving education
  records. Channel: signed email to the school's documented FERPA
  contact, plus a phone call for S0.
- **Written incident report: within 72 hours** including scope, data
  categories affected, individuals affected if known, mitigation taken,
  and corrective actions. This aligns with the 72-hour written-notice
  expectation many institutions require in their vendor agreements
  and is consistent with GDPR Article 33 / state-law breach-notice
  baselines (e.g., NY SHIELD, CA AB 1130).
- **State / Department-of-Education notice:** schools handle their own
  obligations; we provide the evidence package. <!-- TODO(legal): confirm whether ClubIt itself has direct obligations under any state student-data-privacy statute (e.g., NY Ed Law 2-d, IL SOPPA, CT 10-234bb). -->

FERPA citation: 34 CFR § 99.31(a)(1)(i)(B) (school official exception)
requires the institution to maintain "direct control" over the vendor's
use of records. Our notification SLAs are the operational counterpart of
that control.

## Universal first 30 minutes

Regardless of incident type, the IC should:

1. **Open a timeline doc.** Log every action with UTC timestamp.
2. **Stop the bleed.** If a credential is suspected leaked, rotate first
   (don't wait for analysis). If an endpoint is being abused, block it
   at the Vercel function level (return 503 from the route, then
   redeploy).
3. **Preserve evidence.** Pull Vercel function logs, Supabase logs,
   Clerk audit log (Clerk dashboard → Audit logs), Stripe events log.
   Logs are ephemeral on Vercel — capture before the rolling window
   evicts them.
4. **Classify severity.** Decide S0/S1/S2/S3.
5. **Notify.** Internal channel for S2+; affected institutions for
   confirmed S0/S1 within 24h.
6. **Decide on customer-facing comms.** Draft, even if not sent yet.

## Playbook: leaked secret

A real secret (Clerk, Stripe, Supabase, OpenAI, etc.) appears in a
Git commit, a public log, a screenshot, or any non-encrypted location.

**Worked example.** This is exactly what happened with the Clerk
backend secret committed in `tests/e2e/create-accounts.spec.ts:18` at
commit `675af6f` ("fix: route profile/override saves through API to
bypass RLS, add E2E tests"). The recovery actions taken were:

1. Rotate the Clerk secret in the Clerk dashboard. Confirm the new
   secret works in `.env.local`. The old secret must be invalidated
   before anything else.
2. Replace the literal in the test fixture with `process.env.CLERK_SECRET_KEY`
   and gate the test on its presence (commit `b67395d`,
   "chore(tests): read Clerk secret from env instead of hardcoding").
3. Add a `pre-commit` hook that blocks any future committed line
   matching `sk_(test|live)_<20+ chars>`, `whsec_<20+>`, or a
   JWT-shaped triple. Add a `tests/security/test_w1_1_no_secrets_in_tree.spec.ts`
   regression test (commit `fef2da9`).
4. Scrub the secret from Git history with `git filter-repo --replace-text`
   (commit `b67395d` carries the rewritten history; force-push followed).
5. Email GitHub Support to expire orphan refs (otherwise the old SHA
   remains reachable for ~90 days).
6. Audit Clerk's audit log for any API call from the leaked key
   between commit time and rotation time. <!-- TODO(security): file the audit-log evidence under docs/security/incidents/W1.1/. -->
7. Tell every collaborator to discard their clone and re-clone — `git
   pull` will not remove the secret from their reflog.
8. Post-mortem: publish a redacted incident report to affected
   institutions (none yet — pre-pilot).

For any future leak, follow the same sequence. The `SECRETS_POLICY.md`
"if you discover a leaked secret" section is the abridged version.

## Playbook: RLS bypass discovered

A query is found that returns rows from a table the caller should not
see, or a write succeeds that should have been rejected.

1. **Reproduce** in a non-production environment with a checked-in
   regression test under `tests/security/`.
2. **Classify.** Cross-tenant exposure → S0. Cross-club inside one
   school → S0 if it covers chat/attendance/votes/forms (per the
   tenant boundary invariants in `THREAT_MODEL.md`); otherwise S1.
3. **Contain.** Two options:
   - Disable the offending route at the Next.js layer (return 503,
     redeploy) while a policy fix is prepared.
   - Tighten the RLS policy with a new migration (`supabase/migrations/`)
     and apply via `supabase db push` / SQL editor.
4. **Verify.** Re-run the regression test against production with a
   read-only test account.
5. **Backfill.** Pull Supabase logs for the time window between policy
   weakness and fix; identify whether anyone exercised the bypass. If
   yes, classify as a data breach and trigger institutional notice.
6. **Post-mortem.** Add a row to the `THREAT_MODEL.md` STRIDE table.

## Playbook: Supabase compromise suspected

Indicators include unexpected schema changes, unfamiliar service-role
key usage, leaked `SUPABASE_SERVICE_ROLE_KEY`, or anomalous query
patterns in Supabase logs.

1. **Rotate the service-role key** in the Supabase dashboard. This
   invalidates every API route using the old key — they will start
   returning 500s. Update Vercel project env vars immediately and
   redeploy.
2. **Rotate the JWT signing secret** (Supabase project settings → API).
   This invalidates every realtime subscription and forces every
   browser to re-authenticate.
3. **Snapshot the database.** `pg_dump` to a separate, access-controlled
   bucket. Tag with timestamp.
4. **Audit `auth.users`, `users`, `pending_schools`, `schools`** for
   rows created or modified during the suspected compromise window.
   Look for `role` flips and unexpected `school_id` assignments.
5. **Check Supabase access logs** (project → Logs → Postgres) for
   queries against `users`, `chat_messages`, `attendance_*`,
   `poll_votes`, `election_votes` from unfamiliar IPs.
6. **Decide whether to restore from a clean backup.** Supabase keeps
   point-in-time recovery for paid projects. Coordinate with affected
   institutions before destructive restore.
7. **Notify** all institutions whose schools have data in the compromised
   project, even if scoping is unclear — better an over-notification
   than a delayed one.

## Playbook: Clerk compromise suspected

(Includes the C-1 leaked-secret case as a special instance.)

1. Rotate the Clerk secret immediately.
2. In the Clerk dashboard, run "Sign out all users" — this invalidates
   every active session.
3. Audit Clerk's audit log for: `user.created`, `user.updated` (look
   for `publicMetadata.role` changes), `session.created` from unusual
   IPs, `organization.created`. Export to evidence bucket.
4. Cross-reference with our DB: any `users.role` other than `student`
   created during the window must be re-verified out-of-band.
5. Notify institutions if any of the audited changes affect their
   tenant.

## Post-incident

After every S0/S1:

- Publish a written post-mortem to <!-- TODO(business): post-mortem repo / Google Drive folder. --> within two weeks. Use the
  blameless format: timeline, what went well, what went poorly,
  corrective actions with owners and due dates.
- Add a regression test under `tests/security/` so the same class of
  bug fails the build next time.
- Update `THREAT_MODEL.md` if a new attack class was uncovered.
- File evidence package (logs, queries, decisions) in
  `docs/security/incidents/<YYYY-MM-DD>-<slug>/`. <!-- TODO(security): create directory after first incident. -->

## Tabletop / drill schedule

- Run a tabletop on this runbook **at least quarterly**. <!-- TODO(business): schedule first drill, owner, calendar invite. -->
- Rotate scenarios across the three playbooks above so each is
  exercised at least once per year.
- Capture findings; if any role contact is stale, fix the doc the
  same day.
