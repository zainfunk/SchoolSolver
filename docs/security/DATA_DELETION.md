# Data deletion

This document describes how a school (or, where applicable, a student
or parent acting through their school) requests deletion of education
records held by ClubIt, and what the platform actually does in
response.

It also covers the gap between the destructive endpoint that exists
today (`DELETE /api/superadmin/schools/[id]`) and what FERPA / common
state student-data-privacy statutes expect.

## Who can request what

- **Schools (institutional contact).** Can request deletion of the
  school tenant and all education records within it. Channel:
  `security@clubit.app`. Identity is verified by reply to the school's
  documented FERPA/IT contact email — not the requester's own address.
- **Parents / eligible students (under FERPA).** Direct requests to
  ClubIt are forwarded to the institution; the institution decides
  whether the data is an education record under their control and
  instructs us. We do not currently expose a self-service deletion
  endpoint to end users. <!-- TODO(legal): confirm whether any state law (e.g., NY Ed Law 2-d, IL SOPPA, CA SOPIPA) requires us to honor parent requests directly even absent institutional instruction. -->
- **Superadmins (ClubIt internal).** Can execute the destructive
  endpoint to action a verified request.

## SLAs

| Step | Target | Notes |
|---|---|---|
| Acknowledge request | 2 business days | Email reply confirming we received the request and describing what will happen. |
| Identity verification | within 5 business days | Reply-to-known-contact for schools; institutional channel for individual subjects. |
| Execute deletion | within 30 calendar days of verified request | Actual `DELETE /api/superadmin/schools/[id]` run. |
| Backups expire | within 90 calendar days | Supabase point-in-time recovery and our own snapshots roll out of retention; document the expiry date in the closure email. |
| Closure confirmation | within 60 calendar days | Final email to institution confirming live deletion done and giving the date by which backups will have expired. |

<!-- TODO(legal): confirm SLAs against the institutional agreement template; some districts require 30-day total turnaround including backups. -->

## What the destructive endpoint does today

Source: `app/api/superadmin/schools/[id]/route.ts` (DELETE handler).

It runs ~13 sequential best-effort `DELETE`s against Postgres in
dependency order. The current scope is:

**Removed:**

- `chat_messages`, `memberships`, `join_requests`, `events`,
  `club_news`, `attendance_records`, `attendance_sessions`, `polls`,
  `leadership_positions`, `club_social_links`, `meeting_times` for
  every club whose advisor belongs to the school.
- `clubs` whose `advisor_id` is in the school's user list.
- `issue_reports` and `notifications` scoped by `school_id`.
- The `schools` row itself.

**Modified, not removed:**

- `users` rows are *unlinked* (`school_id = null, role = 'student'`)
  rather than deleted — these are also Clerk identities and the route
  intentionally avoids touching the Clerk side.

**Known gaps (assessment finding H-11 — open):**

- No transaction. A mid-failure leaves the database in an inconsistent
  state.
- Clubs whose `school_id = X` but whose `advisor_id` is null or points
  to a non-school user are **not** deleted — they become orphans.
- `chat_messages.sender_id` continues to reference user rows that we
  unlinked but did not delete; a former student joining a different
  school still appears as the original message author.
- Election/vote tables (`school_elections`, `election_votes`,
  `election_candidates`) are not enumerated in the deletion path even
  though they live under the school.
- No record of what was deleted is written back to an audit log
  (assessment finding M-7 / W3 audit-logging plan).

<!-- TODO(security): the W2/W3 backlog includes wrapping the DELETE in a transaction, scoping by `school_id` directly (not via advisor), and adding audit rows. Track in W3-DELETION-HARDENING. -->

## Future-state design (target)

The deletion endpoint will be re-implemented to:

1. Run inside a single Postgres transaction (or a saga with a
   compensating rollback table).
2. Scope every child delete by `school_id`, not by inferred advisor
   membership.
3. Enumerate every table that has a `school_id` column or transitively
   references one (auto-generate the list from `information_schema`
   and check it against an allowlist).
4. Write an `audit_log` row per table cleared, with row counts.
5. Soft-delete first (`deleted_at = now()`) for a 30-day grace window
   so accidental triggers can be reversed; hard-delete + cascade after
   the grace window.
6. Emit a final report (counts + checksums) that can be sent back to
   the institution as proof of action.

<!-- TODO(security): implement during W3 deletion-hardening sprint. -->

## What we do not delete (and why)

- **Stripe customer + subscription records.** Required for tax /
  financial-records retention. Stripe holds these in Stripe; we delete
  the local copy in `subscriptions` but Stripe retains its own per
  their data-retention policy. Document in the closure email.
  <!-- TODO(legal): confirm financial retention obligation (US: typically 7 years for tax records). -->
- **Backups / snapshots.** Supabase point-in-time recovery and our
  own snapshots are retained for up to 90 days (see SLA table). The
  data is *not accessible* through the application during that window —
  only via a restore that itself requires authenticated console
  access — but the rows still exist on storage media. The closure
  confirmation gives the expected expiry date.
- **Aggregated, de-identified counts.** Not currently produced; if we
  ever publish "X schools, Y students" marketing numbers, we'll
  document the de-identification standard here. <!-- TODO(business): decide whether to produce de-identified analytics; if yes, draft the de-identification policy. -->
- **Logs.** Vercel function logs and Supabase Postgres logs are
  retained for the platform's default windows (Vercel: 1 hour to 30
  days depending on plan; Supabase: 1 day for free, 7 days for Pro).
  We don't try to redact deleted-school identifiers from those logs;
  we rely on log expiry.

## Self-service export

ClubIt does not currently expose a self-service export endpoint for a
school's data. Schools may request an export as part of, or in
advance of, deletion; the export is produced manually as a JSON dump
scoped by `school_id`. <!-- TODO(business): build a `GET /api/superadmin/schools/[id]/export` so this isn't ad hoc. -->

## Verification

Each completed deletion should be verified by:

1. Re-querying every table listed above with `school_id = <deleted>`
   (or via the user/advisor inference for tables that lack
   `school_id`) and confirming zero rows.
2. Confirming the Stripe subscription is canceled and `subscriptions`
   row is removed locally.
3. Recording the verification queries and outputs in the
   `docs/security/incidents/deletion-<YYYY-MM-DD>-<school>/` evidence
   folder. <!-- TODO(security): create folder convention on first execution. -->
