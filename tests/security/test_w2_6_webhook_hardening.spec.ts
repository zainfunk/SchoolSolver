/**
 * W2.6 — verify the duplicate Stripe webhook handler is gone and the
 * canonical handler refuses unsigned/misconfigured deliveries.
 *
 * Closes finding C-6 from ClubIt-Security-Assessment.md.
 *
 * Three checks:
 *  1. The deleted route (`app/api/webhooks/stripe/route.ts`) is not
 *     present in the source tree -- if anyone re-introduces it, the
 *     test fails until they read the assessment.
 *  2. The canonical handler imports `requireWebhookSecret` from
 *     `lib/stripe.ts` (so the production startup guard is wired up).
 *  3. `requireWebhookSecret` throws when NODE_ENV=production and
 *     STRIPE_WEBHOOK_SECRET is unset.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

describe('W2.6: Stripe webhook hardening', () => {
  it('the duplicate handler `/api/webhooks/stripe/route.ts` is deleted', () => {
    const path = join(ROOT, 'app', 'api', 'webhooks', 'stripe', 'route.ts')
    expect(existsSync(path), `unexpected: ${path} exists; W2.6 should have deleted it`).toBe(false)
    // The whole `webhooks` directory should be gone.
    expect(existsSync(join(ROOT, 'app', 'api', 'webhooks'))).toBe(false)
  })

  it('the canonical handler wires up requireWebhookSecret', () => {
    const path = join(ROOT, 'app', 'api', 'stripe', 'webhook', 'route.ts')
    expect(existsSync(path)).toBe(true)
    const src = readFileSync(path, 'utf8')
    expect(src).toMatch(/requireWebhookSecret/)
  })

  it('proxy.ts no longer whitelists /api/webhooks/*', () => {
    const src = readFileSync(join(ROOT, 'proxy.ts'), 'utf8')
    // The active matcher line is gone. We allow the comment string to
    // remain for context but the active route pattern must not.
    const activeLine = src.split('\n').find((l) => /^\s*'\/api\/webhooks\//.test(l))
    expect(activeLine, `unexpected active matcher: ${activeLine}`).toBeUndefined()
  })

  it('requireWebhookSecret throws in production when secret is unset', async () => {
    const original = { node: process.env.NODE_ENV, vercel: process.env.VERCEL, secret: process.env.STRIPE_WEBHOOK_SECRET }
    try {
      // @ts-expect-error -- writable in test
      process.env.NODE_ENV = 'production'
      delete process.env.VERCEL
      delete process.env.STRIPE_WEBHOOK_SECRET
      const mod = await import('@/lib/stripe')
      expect(() => mod.requireWebhookSecret()).toThrow(/STRIPE_WEBHOOK_SECRET/i)
    } finally {
      // Restore env.
      // @ts-expect-error -- writable in test
      process.env.NODE_ENV = original.node
      if (original.vercel !== undefined) process.env.VERCEL = original.vercel
      if (original.secret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = original.secret
    }
  })

  it('requireWebhookSecret returns the secret when set', async () => {
    const original = process.env.STRIPE_WEBHOOK_SECRET
    try {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy'
      const mod = await import('@/lib/stripe')
      expect(mod.requireWebhookSecret()).toBe('whsec_test_dummy')
    } finally {
      if (original === undefined) delete process.env.STRIPE_WEBHOOK_SECRET
      else process.env.STRIPE_WEBHOOK_SECRET = original
    }
  })
})
