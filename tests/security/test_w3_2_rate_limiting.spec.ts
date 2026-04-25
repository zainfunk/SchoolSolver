/**
 * W3.2 — verify the rate limiter (lib/rate-limit.ts) actually limits.
 *
 * Closes finding W3.2 / H-8.
 *
 * Strategy: in-memory fallback path (no Upstash env) is what every CI
 * run hits, so test it. The Upstash path is structurally identical
 * (slidingWindow with the same config); it gets verified manually
 * once UPSTASH_REDIS_REST_URL/_TOKEN are wired into staging.
 */
import { describe, it, expect, beforeEach } from 'vitest'

describe('W3.2: rate limiting', () => {
  // Force the in-memory fallback by ensuring Upstash env vars are unset.
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it('joinLimiter allows the first 5 hits and rejects the 6th', async () => {
    // Fresh import per test so the in-memory store starts clean.
    const mod = await import('@/lib/rate-limit?w32a' as string)
    const key = `test-w32-join-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      const r = await mod.joinLimiter.check(key)
      expect(r.success, `hit ${i + 1} should succeed`).toBe(true)
    }
    const blocked = await mod.joinLimiter.check(key)
    expect(blocked.success).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('onboardLimiter is stricter than joinLimiter (3 vs 5)', async () => {
    const mod = await import('@/lib/rate-limit?w32b' as string)
    const key = `test-w32-onb-${Date.now()}`
    for (let i = 0; i < 3; i++) {
      const r = await mod.onboardLimiter.check(key)
      expect(r.success, `hit ${i + 1}`).toBe(true)
    }
    const blocked = await mod.onboardLimiter.check(key)
    expect(blocked.success).toBe(false)
  })

  it('different keys do not share buckets', async () => {
    const mod = await import('@/lib/rate-limit?w32c' as string)
    const a = `test-w32-keyA-${Date.now()}`
    const b = `test-w32-keyB-${Date.now()}`
    for (let i = 0; i < 5; i++) await mod.joinLimiter.check(a)
    const blockedA = await mod.joinLimiter.check(a)
    expect(blockedA.success).toBe(false)
    const okB = await mod.joinLimiter.check(b)
    expect(okB.success).toBe(true)
  })

  it('result includes Retry-After-compatible seconds', async () => {
    const mod = await import('@/lib/rate-limit?w32d' as string)
    const key = `test-w32-ra-${Date.now()}`
    for (let i = 0; i < 5; i++) await mod.joinLimiter.check(key)
    const blocked = await mod.joinLimiter.check(key)
    expect(blocked.retryAfter).toBeGreaterThan(0)
    expect(blocked.retryAfter).toBeLessThanOrEqual(900) // join window is 900s
  })

  it('the deprecated rateLimit() shim still works for back-compat', async () => {
    const mod = await import('@/lib/rate-limit?w32e' as string)
    const key = `test-w32-shim-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      const r = await mod.rateLimit(key)
      expect(r.success, `hit ${i + 1}`).toBe(true)
    }
    const blocked = await mod.rateLimit(key)
    expect(blocked.success).toBe(false)
  })
})
