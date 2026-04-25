# Subprocessors

ClubIt processes education records (FERPA) and personal data with
help from a small set of third-party subprocessors. This page is the
canonical list. We update it whenever a vendor is added, removed, or
materially repurposed.

Schools have the right to be notified of subprocessor changes; our
notification cadence is documented in the FERPA agreement template
(`FERPA_AGREEMENT_TEMPLATE.md`).

## Active subprocessors

| Vendor | Role | Data processed | Region(s) | DPA / agreement |
|---|---|---|---|---|
| **Vercel, Inc.** | App hosting, edge network, serverless function runtime, build platform. | All HTTP request/response payloads (incl. session cookies, API bodies). Logs are retained per Vercel plan. | US (primary edge); global edges. | DPA: <https://vercel.com/legal/dpa>. <!-- TODO(legal): confirm DPA executed and on file; capture date. --> |
| **Supabase, Inc.** | Postgres database, realtime broadcast, object storage, JWT-bridge auth (Clerk → Postgres RLS). | All education records: chat, attendance, polls, votes, rosters, profile data, billing-link metadata. | US (project region: <!-- TODO(business): confirm Supabase project region. -->). | DPA: <https://supabase.com/legal/dpa>. <!-- TODO(legal): execute DPA; subprocess flow-down to AWS (Supabase's underlying provider) — confirm acceptable. --> |
| **Clerk, Inc.** | Authentication, session management, user profiles (name, email, OAuth identities, password hashes). | Account identities for all users. Does not see club / chat / attendance content. | US. | DPA: <https://clerk.com/legal/dpa>. <!-- TODO(legal): execute DPA; capture date. --> |
| **Stripe, Inc.** | Subscription billing, hosted checkout, payment-method capture, webhooks. | School billing contact (name, email), subscription status, plan IDs. **No** student PII. Card numbers never touch our servers (Stripe Elements / hosted checkout). | US, EU. | DPA: <https://stripe.com/legal/dpa>. <!-- TODO(legal): execute DPA; capture date. --> |
| **Codemagic** | iOS CI: builds the Capacitor wrapper, signs, optionally uploads to TestFlight (`codemagic.yaml`). | Source code at build time, build artifacts (`.ipa`/`.xcarchive`), App Store Connect API key. **No** student PII. | EU (Estonia). | Terms: <https://codemagic.io/legal/>. <!-- TODO(legal): confirm DPA available; capture date. --> |

## Sub-subprocessors (declared by our subprocessors)

These are subprocessors of our subprocessors. We rely on the upstream
vendor's contractual flow-downs for compliance. Listed for transparency
when an institution asks.

- **AWS** (used by Supabase and Stripe internally).
- **Google Cloud** (used by Clerk for some infrastructure components).
- **Cloudflare** (CDN and DNS for several of the above).

<!-- TODO(security): re-verify against each vendor's published sub-subprocessor list at next quarterly review; vendors update without notifying us. -->

## What each vendor does *not* see

We document this so that schools can scope their data-flow questions:

- **Stripe** does not see chat messages, attendance, votes, or any
  data tied to individual students. It sees the school billing
  contact and plan only.
- **Clerk** does not see club content. It sees identity (name, email,
  OAuth tokens) and Clerk-side `publicMetadata` (which currently
  includes role and school_id — we treat these as administrative
  pointers, not education records).
- **Vercel** sees all in-flight payloads (it runs the code). It does
  not have direct DB access; it runs as a stateless function tier.
- **Codemagic** sees source code and build artifacts at build time.
  No production data passes through Codemagic.
- **Supabase** is the only vendor that holds education records at
  rest.

## Data-residency

ClubIt does not currently make data-residency commitments beyond the
underlying vendor regions listed above. <!-- TODO(business): decide whether US-only residency is a contractual commitment or a best-effort posture; some districts require US-only with no EU touchpoints. -->

## Transfers outside the US

Codemagic operates from the EU. The build artifacts they produce do
not contain student data, so no cross-border education-record
transfer occurs. Our Supabase project region and Stripe's processing
locations are configurable at vendor onboarding time and locked to
US for ClubIt's primary tenant. <!-- TODO(legal): if/when we onboard non-US schools, document SCCs and additional safeguards. -->

## Adding or changing a subprocessor

1. Update this file in a PR. The PR description must include: vendor,
   purpose, data categories, region, DPA link.
2. Notify institutions per the FERPA agreement notice clause
   (currently: 30 days advance notice for material additions).
   <!-- TODO(legal): confirm notice window in the executed agreements. -->
3. If the change is in response to an incident or security-required
   migration, the notice may be shortened — document the rationale.

## Removing a subprocessor

1. Confirm no production data path still flows to the vendor.
2. Revoke API keys / OAuth grants on the vendor's side.
3. Delete the row from this table. Annotate in a `Removed` section
   below with the date and reason.

## Removed

(none yet)
