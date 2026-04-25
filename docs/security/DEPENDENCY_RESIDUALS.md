# Residual dependency vulnerabilities

`npm audit --omit=dev` is run as part of CI. This document tracks
findings that cannot be auto-remediated and the plan for each.

Re-evaluate this list before every release.

## Currently outstanding (as of last `npm install`)

### postcss < 8.5.10 (GHSA-qx2v-qp2m-jg93) — moderate

- **Path:** `node_modules/next/node_modules/postcss`, transitively from
  `@clerk/nextjs > next > postcss`.
- **CVE:** XSS via unescaped `</style>` in CSS stringify output.
- **Why we cannot fix today:** Next.js 16.2.4 declares an exact pin on
  postcss < 8.5.10; `npm audit fix --force` would downgrade Next.js to
  a major-version-back, which has its own GHSA-q4gf-8mx6-v5v3 (DoS in
  Server Components, high severity). Going backwards is not a valid
  remediation.
- **Exposure assessment:** the postcss XSS surface is server-side CSS
  generation. Our app does not stringify user-controlled CSS — all
  styling is via Tailwind classes generated at build time from
  static source. Risk is theoretical.
- **Plan:** monitor for `next@16.2.5` or later that picks up postcss
  ≥ 8.5.10. Dependabot is configured to open the PR automatically.
- **Owner:** the same human who reads this file at next release.

## How findings get added here

When `npm audit` reports a vulnerability that we choose not to fix
immediately, add an entry above with: package + version range, CVE/GHSA
ID, why we can't fix today, exposure assessment, and the remediation
plan. Empty residual list is the goal.

Entries that have been resolved should be moved to a "Resolved" section
below with the commit hash that resolved them and date.

## Resolved

- **@clerk/nextjs <7.2.1 (GHSA-vqx2-fgx2-5wq9, critical):** bumped to
  ^7.2.7 in commit `<W1.2-commit>`.
- **hono <4.12.12, @hono/node-server <1.19.13:** transitively resolved
  by the Clerk bump above.
- **next <16.2.4 (GHSA-q4gf-8mx6-v5v3, high):** bumped to 16.2.4 in the
  same W1.2 commit.
