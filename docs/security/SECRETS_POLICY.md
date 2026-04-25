# Secrets policy

## What counts as a secret

- API keys / tokens for any vendor (Clerk, Stripe, Supabase, OpenAI, etc.)
- Database passwords or connection strings with embedded credentials
- Webhook signing secrets (Stripe `whsec_...`, etc.)
- JWT signing secrets / Supabase `service_role` key
- Any credential that grants access to anything beyond a single dev's
  laptop

## Where they live

| Where | What | Committed? |
|---|---|---|
| `.env.local` (each developer's machine) | dev-tier secrets | **No** — `.env*` is in `.gitignore` |
| Vercel project Environment Variables | prod / preview tier secrets | **No** |
| Clerk dashboard, Supabase dashboard, Stripe dashboard | source of truth for each | **No** |
| `.env.example` | placeholder names only, never values | Yes |

## Pre-commit guard

`./.husky/pre-commit` runs on every commit and blocks staged changes that
match a fully-formed secret pattern (`sk_test_<20+ chars>`,
`whsec_<20+>`, JWT-shaped triples, etc.). To bypass for a known false
positive, use `git commit --no-verify` and explain why in the commit body.

The hook is installed automatically when you run `npm install`. If your
clone is missing the hook, run `npm run prepare`.

## Regression test

`tests/security/test_w1_1_no_secrets_in_tree.spec.ts` walks the working
tree and fails CI if any committable file matches the same patterns. Run
locally with `npm test`.

## If you discover a leaked secret

1. **Rotate it first** — in the vendor's dashboard. Treat the old value
   as compromised the moment it's been seen anywhere it shouldn't be
   (chat logs, screenshots, screen-shares, public repos, anyone's
   non-encrypted backup).
2. Remove from the working tree.
3. Scrub from git history (`git filter-repo --replace-text`); the
   incident at commit `675af6f` was scrubbed in commit `b67395d`.
4. Force-push (`git push --force-with-lease`).
5. Email GitHub Support to expire orphaned commits — without this the
   old SHA is still reachable for ~90 days.
6. Tell every collaborator to discard their clone and re-clone; `git
   pull` will not remove the secret from their reflog.
7. Audit access logs from the moment of leak forward.

The full incident playbook is at `docs/security/INCIDENT_RESPONSE.md`
(scaffolded in W4.2).
