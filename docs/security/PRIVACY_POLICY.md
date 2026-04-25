# ClubIt Privacy Policy

**Last updated:** <!-- TODO(business): publish date when this is first linked from production. -->

This page is the privacy policy a marketing site or app store listing
would link to. Plain English; no dark patterns. Every blank below
that requires a business decision is marked `<!-- TODO -->`.

This policy applies to ClubIt's web application and the iOS app that
wraps it (built via Capacitor). It does **not** apply to your school's
own systems or to third-party sites we link to.

## TL;DR

- ClubIt is a tool your school chose. We process your data on the
  school's behalf, not for our own purposes.
- We do not sell your data. We do not advertise. We do not train AI
  on your data.
- The data your school gives us (name, email, club rosters,
  attendance, chat in club channels, votes, profile info you choose
  to add) stays in our database, accessible only to authorized
  members of your school per our access rules.
- You have rights to access, correct, and delete your data — usually
  exercised through your school. Contact details are at the bottom.

## Who we are

ClubIt is operated by <!-- TODO(business): legal entity name and US address -->.
Reach us at `security@clubit.app` for security or privacy questions,
or `support@clubit.app` for everything else. <!-- TODO(business): confirm both inboxes exist. -->

## What data we collect

**From you, through Clerk (our authentication provider):**

- Your name and email when you sign up.
- A password hash if you sign up with a password (we never see your
  raw password).
- An OAuth token if you sign up with Google or another social
  provider.

**From you, through ClubIt directly:**

- Your school (selected via an invite code your school provides).
- Your role in the school (student, advisor, admin) — set by your
  school's admin or by joining with the right invite code.
- Profile information you choose to add: bio, social links, profile
  picture, optional pronouns.
- Privacy preferences for things like the leaderboard.

**About your activity in ClubIt:**

- Clubs you join and your role in them.
- Attendance records when an advisor takes attendance for an event
  you attend.
- Chat messages you send in club channels.
- Votes you cast in polls and elections (votes are anonymized in
  what other students see — see "Votes" below).
- Hours and badges earned through participation.
- Forms and form responses tied to your clubs.

**About your device, automatically:**

- IP address and a session identifier (to keep you signed in).
- Browser / OS version (for compatibility and abuse prevention).
- Performance metrics about page loads and errors.

We do not collect: precise geolocation (advisors who take GPS-stamped
attendance contribute the **session** location, not a student's
location); contacts; biometrics; payment-card numbers (Stripe handles
those); or anything else not listed above.

## How we use your data

We use the data above to:

1. Run the ClubIt service for your school (the actual feature
   surface).
2. Keep the service secure (rate limiting, abuse detection, audit
   logs).
3. Bill your school (subscription billing only; no student-level
   billing).
4. Communicate with you about service changes and outages.
5. Comply with our legal obligations.

We do **not** use your data to:

- Sell, rent, or trade it.
- Show ads in ClubIt or anywhere else.
- Build cross-context advertising profiles.
- Train machine-learning models. <!-- TODO(business): confirm final position; this is the strict default. If product later wants narrowly-scoped, opt-in features that use ML on de-identified data, this section must be amended and notice given. -->

## Who we share your data with

ClubIt is provided to you because your school signed up for it. The
school is the controller of your education records under FERPA; we
are the processor.

- **Your school's authorized administrators** see administrative
  data for the school (rosters, billing, settings).
- **Advisors and managers of clubs you join** see roster data,
  attendance, and chat for those clubs.
- **Other members of clubs you join** see chat in those club
  channels and your name in the roster (per your privacy settings
  for things like the leaderboard).
- **Our subprocessors** (Vercel, Supabase, Clerk, Stripe, Codemagic)
  process data strictly on our instructions. The full list with
  what each one sees is at `docs/security/SUBPROCESSORS.md`.
- **Law enforcement / regulators** only when compelled by valid
  legal process; we will notify you (or the school, where
  appropriate) before disclosing where lawful.

We do **not** share your data with advertisers, data brokers, or any
party not listed above.

## Votes

Polls and school-wide elections in ClubIt use a secret ballot. Your
classmates and club leaders cannot see how you voted. We retain the
vote-to-voter linkage server-side only to prevent double-voting; it
is not exposed in any user-facing API.

## Retention

- **While your school is a customer:** we keep your data for as long
  as you have an account.
- **When you leave a club / school:** your activity history (chat,
  votes, attendance) remains in the school's records under the
  school's control unless the school requests deletion on your
  behalf.
- **When your school stops using ClubIt:** we delete the school's
  data within 30 days of termination, with backup expiry within 90
  days. Details: `docs/security/DATA_DELETION.md`.
- **Audit logs and security logs:** retained for <!-- TODO(business): retention window; 1 year is a defensible default --> for security and forensics.
- **Financial records:** retained for the period required by tax
  law (typically 7 years in the US). <!-- TODO(legal): confirm. -->

## Your rights

Depending on your jurisdiction (FERPA in US schools, plus state laws
like CCPA/CPRA in California, NY Ed Law 2-d in New York, IL SOPPA in
Illinois, etc.):

- **Access** — request a copy of the data we have about you.
- **Correction** — ask us to fix data that's wrong.
- **Deletion** — ask us to delete your data, subject to retention
  obligations.
- **Portability** — receive your data in a machine-readable format.
- **Objection / restriction** — object to certain processing.

Because your school is the controller of your education records,
most rights are exercised through your school's FERPA contact. You
can also email `security@clubit.app` and we will route the request
appropriately.

We aim to respond within 30 days. We will not retaliate for
exercising your rights.

## Children under 13 (COPPA)

ClubIt is intended for school use under the school's authority. When
the school enrolls students under 13, the school provides verifiable
parental consent through the school's normal processes; ClubIt
relies on that consent. We do not directly collect data from
children outside this school-authorized context. <!-- TODO(legal): confirm reliance-on-school posture is sufficient for the institutions we onboard; some districts require explicit parental consent flow inside the product. -->

If we learn that a child under 13 has signed up without their
school's authorization, we will delete the account.

## Security

Our security practices are documented in `docs/security/` and
include:

- Encryption in transit (HTTPS for all traffic).
- Row-level security in our database, scoped to club membership and
  school tenant.
- A pre-commit hook that blocks committed secrets, plus a regression
  test in CI.
- A documented incident-response plan with 24-hour initial breach
  notification (`INCIDENT_RESPONSE.md`).

No system is perfectly secure. We disclose vulnerabilities and
remediation status in `docs/security/ClubIt-Security-Assessment.md`
when they are relevant to current users.

## International users

ClubIt is hosted in the United States. By using it you agree to your
data being processed in the US. <!-- TODO(legal): if/when we onboard non-US schools, document SCCs and add EEA/UK-specific rights. -->

## Changes to this policy

We will post material changes here and notify the school's
administrative contact at least 30 days before they take effect.

## Contact

- Privacy and security: `security@clubit.app`
- General support: `support@clubit.app`
- Mailing address: <!-- TODO(business): US mailing address. -->
