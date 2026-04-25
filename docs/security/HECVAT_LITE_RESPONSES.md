# HECVAT Lite — ClubIt Responses (draft)

This is a draft set of responses to HECVAT Lite section codes
(HLDP, APPL, AUTH, DATA, HRPI, THRD, TPVD, CHNG). It reflects the
state of remediation as of HEAD on `main` (the same commit referenced
by the external assessment in `ClubIt-Security-Assessment.md`).

For sections we'd fail today (per assessment §7), the answer is
"Failing today; remediation in progress under <wave>" with a
pointer to the wave / finding ID. For sections we can answer
honestly today, the answer is the actual answer.

This document is a scaffold. Before submitting a real HECVAT to a
specific institution:

1. Pull the canonical HECVAT Lite XLSX from <https://library.educause.edu/resources/2020/4/higher-education-community-vendor-assessment-toolkit>
   and copy the actual question text into each row.
2. Have the security owner sign off on every "Yes / No / Partial"
   answer.
3. Attach evidence from `docs/security/` where requested.

<!-- TODO(security): re-run this exercise quarterly so the responses don't drift from the codebase. -->

## HLDP — High-Level Documentation & Policy

| Question | Answer | Evidence / status |
|---|---|---|
| Does the vendor have a documented information security policy? | **Partial.** | `docs/security/SECRETS_POLICY.md`, `THREAT_MODEL.md`, `INCIDENT_RESPONSE.md`, `DATA_DELETION.md` are in place. A consolidated infosec policy document is not yet published. **Failing today; remediation in progress under W4.** |
| Does the vendor have an incident response plan? | **Yes.** | `INCIDENT_RESPONSE.md` (this wave). Tabletop drills not yet scheduled — `<!-- TODO(business): first drill date -->`. |
| Does the vendor have a disaster-recovery / business-continuity plan? | **No.** | We rely on Supabase point-in-time recovery and Vercel's platform DR. We do not have a documented DR runbook with RPO/RTO targets. **Failing today; remediation pending W5.** |
| Does the vendor have a documented secure SDLC? | **Partial.** | Pre-commit secret scanner, RLS regression test suite, dev-route stripping in `npm run build:prod`, and a pre-merge security wave process are in place. A consolidated SDLC document is not yet published. **Remediation in progress under W4.** |
| Has the vendor completed a SOC 2 Type II? | **No.** | Not in scope for current size; institutions requiring SOC 2 should expect we are pre-SOC-2. We can share the HECVAT and a third-party penetration-test report when complete. |
| Has the vendor completed an external penetration test? | **No.** | One external code review has been completed (`ClubIt-Security-Assessment.md`) and is being remediated. A third-party penetration test against the remediated build is planned. **Failing today; remediation pending §9 item 19 of the assessment.** |
| Does the vendor maintain a Software Bill of Materials (SBOM)? | **Partial.** | `package.json` + `package-lock.json` constitute the SBOM. `npm audit --omit=dev` runs in CI. Residual findings are tracked in `DEPENDENCY_RESIDUALS.md`. We do not yet emit a CycloneDX/SPDX export. |

## APPL — Application Security

| Question | Answer | Evidence / status |
|---|---|---|
| Are dependencies actively monitored for vulnerabilities? | **Yes.** | `npm audit` in CI; Dependabot (GitHub native) opens PRs. `DEPENDENCY_RESIDUALS.md` tracks accepted residuals. `@clerk/nextjs` was bumped to `^7.2.7` to remediate GHSA-vqx2-fgx2-5wq9 (assessment **C-2**, commit `aea5419`). |
| Is RLS or equivalent tenant isolation enforced at the database layer? | **Yes — with caveats.** | Postgres RLS with per-club membership predicates (migration `0002_club_membership_rls.sql`, commit `ca928df`). API routes still use the service role for many writes (assessment **C-8**); architectural fix tracked under W3. **Partial.** |
| Are votes anonymized to other users? | **Yes.** | Migration `0004_secret_ballot.sql` (commit `a4a419b`) drops voter identity from policy projections (assessment **H-3**). |
| Are security headers (CSP, HSTS, X-Frame-Options, etc.) configured? | **No.** | `next.config.ts` is empty (assessment **H-7**). **Failing today; remediation in progress under W3.** |
| Is there input validation / output encoding for all user input? | **Partial.** | `lib/sanitize.ts` strips `<>` from text; `socials` JSONB is not yet schema-validated (assessment **H-10**). **Remediation in progress under W2.** |
| Are dev-only routes prevented from shipping to production? | **Yes.** | `npm run build:prod` runs `scripts/strip-dev-routes.mjs` and `scripts/check-no-dev-routes.mjs`; production build fails if any dev route survives (commit `27264f7`, finding **W1.6**). |
| Does the application use a Content Security Policy? | **No.** | **Failing today; remediation in progress under W3.** |
| Are secrets stored outside source control? | **Yes, now.** | `.env.local` gitignored; pre-commit hook blocks committed secrets; regression test in CI; `SECRETS_POLICY.md` is the policy. The previously leaked Clerk secret (assessment **C-1**, commit `675af6f`) was rotated and history scrubbed (commit `b67395d`). |

## AUTH — Authentication, Authorization, Accounting

| Question | Answer | Evidence / status |
|---|---|---|
| Is multi-factor authentication available? | **Available via Clerk** (Clerk supports TOTP / SMS). | **Not enforced** for `admin` / `superadmin` (assessment **M-5**). **Failing today; remediation pending W3.** |
| Is SSO (SAML / OIDC) supported? | **Partial.** | OIDC via Clerk's social providers (Google, Microsoft) is supported. SAML / Shibboleth integration with institutional IdPs is not. **Failing today; remediation pending §9 item 15.** |
| Is account lockout configured? | **Provider-managed.** | Whatever Clerk's defaults are. We do not configure or document Clerk policy from our side. **Failing today; remediation in progress.** |
| Are admin actions audit-logged? | **No.** | Application audit log not yet implemented (assessment **H-9**, **M-7**). **Failing today; remediation pending W3.** |
| Can users self-promote to admin or superadmin? | **No, post-W1.** | RLS lockdown on `users` insert/update (migration `0001_users_rls_lockdown.sql`, commit `32bb45d`) closes the C-5 path. |
| Is role assignment auditable? | **No.** | Same gap as the audit-log question above. |
| Are sessions invalidated on role change or password reset? | **Provider-managed.** | Clerk handles session lifecycle. We do not currently force a re-auth on application-side role changes. <!-- TODO(security): force-revalidate Clerk sessions when `users.role` is changed. --> |

## DATA — Data Protection

| Question | Answer | Evidence / status |
|---|---|---|
| Is data encrypted in transit? | **Yes.** | All HTTP traffic over TLS via Vercel; Supabase enforces TLS for client connections. |
| Is data encrypted at rest? | **Yes — at the platform layer.** | Supabase encrypts Postgres at rest (AES-256, AWS-managed keys). Vercel function logs encrypted at rest. We do not implement application-layer encryption. |
| Is end-to-end encryption advertised? | **No.** | We previously had marketing copy claiming E2EE; that was removed (assessment **§7 "End-to-end encrypted" claim**, commit `b32477d`). |
| Is multi-tenant isolation tested? | **Yes.** | RLS regression matrix in `tests/security/` (commit `d92bdbb`) covers club-scoped tables. **Cross-tenant** isolation is also tested. |
| Are data classifications documented? | **Partial.** | `PRIVACY_POLICY.md` enumerates what we collect; an internal data-classification table per category is not yet published. <!-- TODO(security): add data-classification appendix. --> |
| Is there a data-deletion procedure? | **Partial.** | `DATA_DELETION.md` documents process and SLA. The destructive endpoint has known gaps (assessment **H-11**). **Remediation in progress under W3.** |
| Is there a data-export procedure for institutions? | **Partial.** | Manual export only. Self-service export endpoint not yet built. <!-- TODO: §9 item from assessment. --> |
| Are vote ballots secret? | **Yes.** | See AUTH / DATA migration `0004_secret_ballot.sql`. |

## HRPI — HR / Personnel

The vendor is currently a single developer. We disclose this
honestly to institutions during evaluation.

| Question | Answer | Evidence / status |
|---|---|---|
| Are background checks performed on personnel with access to data? | <!-- TODO(business): policy decision. --> | At single-person scale this is not meaningful. As we hire, document a background-check requirement before granting production access. |
| Is security awareness training conducted? | **No formal program.** | The single developer is the security author; the relevant training is doing the work. As we hire, add a formal program. <!-- TODO(business). --> |
| Are personnel under confidentiality / NDA obligations? | <!-- TODO(legal). --> | Add to standard hiring docs before first hire. |
| Is there an offboarding procedure that revokes access? | **Yes (de facto).** | Single-developer team; access revocation is a checklist (Vercel, Supabase, Clerk, Stripe, Codemagic, GitHub, password manager). Document explicitly before first hire. <!-- TODO(business): write down the checklist. --> |

## THRD — Third Parties

| Question | Answer | Evidence / status |
|---|---|---|
| Is there a documented list of subprocessors? | **Yes.** | `SUBPROCESSORS.md`. |
| Are DPAs in place with each subprocessor? | **In progress.** | DPA execution tracked per row in `SUBPROCESSORS.md`. Several rows still marked TODO. |
| Are subprocessor changes notified to institutions? | **Yes — by policy.** | 30-day notice clause in `FERPA_AGREEMENT_TEMPLATE.md` § 11. |
| Are subprocessors limited to those needed to deliver the service? | **Yes.** | Five vendors total. No analytics, advertising, or marketing subprocessors. |
| Is there a vendor-management program? | **Partial.** | `SUBPROCESSORS.md` is the program-of-record; quarterly re-verification is the cadence. |

## TPVD — Third-Party Validation

| Question | Answer | Evidence / status |
|---|---|---|
| Has the vendor been independently audited (SOC 2, ISO 27001, etc.)? | **No.** | **Failing today.** |
| Has the vendor undergone a third-party penetration test? | **No.** | One external code review (`ClubIt-Security-Assessment.md`) is being remediated; a paid penetration test is planned post-remediation. **Failing today.** |
| Does the vendor share the executive summary of any third-party assessment? | **Yes — once they exist.** | The current external review is referenced in this repo; institutions can request the assessment + this remediation log. |
| Is a HECVAT (Lite or Full) on file? | **Lite — this document.** | A Full HECVAT is in scope after the planned penetration test. |

## CHNG — Change Management

| Question | Answer | Evidence / status |
|---|---|---|
| Are code changes peer-reviewed? | **Partial.** | Single-developer team historically. Going forward: every PR requires green CI (lint, vitest, RLS suite) and security-relevant changes go through the wave process documented in `ClubIt-Security-Assessment.md`. <!-- TODO(business): add PR-review-by-second-pair-of-eyes once team grows. --> |
| Are deployments automated? | **Yes.** | Vercel auto-deploys on push to `main`. Codemagic runs the iOS pipeline (`codemagic.yaml`). |
| Are database migrations versioned and reversible? | **Yes — post-W2.** | `supabase/migrations/0001*–0004*` are numbered with `.down.sql` rollbacks (assessment **L-2**). |
| Is there a rollback plan? | **Partial.** | Migrations have down scripts. Application rollback uses Vercel's "promote previous deployment." A documented incident-rollback runbook does not exist. <!-- TODO(security): add to `INCIDENT_RESPONSE.md`. --> |
| Are there separate dev / staging / prod environments? | **Partial.** | Vercel preview deployments per branch act as staging. There is not yet a long-lived staging tenant with synthetic data. <!-- TODO(business): stand up dedicated staging Supabase project. --> |
| Is there a release / change log? | **Yes — git history.** | Git log + commit messages serve as the change log. |
| Are duplicate / orphan handlers detected? | **Yes — post-W1.** | The duplicate Stripe webhook (assessment **C-6** / **M-2**) is on the W3 deletion list. **Failing today; remediation in progress.** |

## Summary scorecard (vendor self-assessment)

| Section | Self-rating | Notes |
|---|---|---|
| HLDP | Partial → improving | IR plan, secrets policy, threat model in place; SDLC + SOC 2 + pen test pending. |
| APPL | Partial → improving | C-1, C-2, C-5, C-7 closed in W1; C-4 closed in W2; H-7, H-10, C-8 in W2/W3. |
| AUTH | Failing | MFA enforcement, SSO/SAML, audit logging all pending. |
| DATA | Partial | Encryption defaults + secret ballot + RLS in place; data classification + self-service export pending. |
| HRPI | N/A at single-person | Will become material as we hire. |
| THRD | Partial | Subprocessor list documented; DPA execution in progress. |
| TPVD | Failing | No third-party audits or pen tests yet. |
| CHNG | Partial | Migrations versioned; PR-review process needs maturity. |

This document supersedes any earlier informal answers. When an
institution requests a HECVAT, snapshot this file with the date and
include a reference to the commit at the time of submission.
