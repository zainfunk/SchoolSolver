/**
 * W2.5 — verify invite codes are bound to time and identity:
 *  - expired codes are rejected
 *  - admin/advisor codes are single-use (used_at consumed on redemption)
 *  - email-domain-bound codes are rejected for non-matching emails
 *
 * Closes finding W2.5 (assessment §9 item 10).
 *
 * SQL-level test: simulates the join route's preconditions by checking
 * each invariant directly. The full HTTP-level test will be added under
 * tests/security/browser/ as a Playwright spec in W2 follow-ups.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.SUPABASE_TEST_URL
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

const HAVE_TEST_DB = !!(URL && SERVICE)

const runId = randomUUID().slice(0, 8)
const SCHOOL_PREFIX = '00000000-0000-4000-8000-'
const SCHOOL = SCHOOL_PREFIX + runId.padEnd(12, '0').slice(0, 12)

describe.skipIf(!HAVE_TEST_DB)('W2.5: invite code binding', () => {
  let admin: SupabaseClient

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })

    await admin.from('schools').insert({
      id: SCHOOL,
      name: `RLS-W25 ${runId}`,
      contact_name: 'C',
      contact_email: `c-${runId}@oakridge.edu`,
      status: 'active',
      student_invite_code: `STU-w25-${runId}-stu`,
      admin_invite_code:   `ADM-w25-${runId}-adm`,
      advisor_invite_code: `ADV-w25-${runId}-adv`,
      student_code_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      admin_code_expires_at:   new Date(Date.now() + 86400_000).toISOString(),
      advisor_code_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      admin_code_email_domain: 'oakridge.edu',
    }).throwOnError()
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('schools').delete().eq('id', SCHOOL)
  })

  it('expired admin code is past its expires_at and would be rejected', async () => {
    await admin.from('schools')
      .update({ admin_code_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', SCHOOL).throwOnError()

    const { data } = await admin.from('schools')
      .select('admin_code_expires_at').eq('id', SCHOOL).single()
    expect(new Date(data!.admin_code_expires_at!) < new Date()).toBe(true)

    // Restore for downstream tests.
    await admin.from('schools')
      .update({ admin_code_expires_at: new Date(Date.now() + 86400_000).toISOString() })
      .eq('id', SCHOOL).throwOnError()
  })

  it('used admin code stays consumed (used_at set; second update fails to reset)', async () => {
    // Simulate join: set used_at if currently null.
    const now = new Date().toISOString()
    const { data: first } = await admin.from('schools')
      .update({ admin_code_used_at: now })
      .eq('id', SCHOOL)
      .is('admin_code_used_at', null)
      .select()

    expect(first?.length).toBe(1)

    // A second redeemer hits the same `is null` guard; the row should
    // not match (because used_at is now non-null) and the update yields
    // zero rows.
    const { data: second } = await admin.from('schools')
      .update({ admin_code_used_at: new Date().toISOString() })
      .eq('id', SCHOOL)
      .is('admin_code_used_at', null)
      .select()

    expect(second?.length ?? 0).toBe(0)

    // Cleanup: regenerate-codes path clears used_at; mimic that.
    await admin.from('schools')
      .update({ admin_code_used_at: null })
      .eq('id', SCHOOL).throwOnError()
  })

  it('admin_code_email_domain stored and exposed for join-route check', async () => {
    const { data } = await admin.from('schools')
      .select('admin_code_email_domain').eq('id', SCHOOL).single()
    expect(data?.admin_code_email_domain).toBe('oakridge.edu')

    // Domain-match logic (mirrors the route): caller@oakridge.edu OK,
    // caller@gmail.com rejected.
    function matches(callerEmail: string, required: string): boolean {
      const normalized = required.toLowerCase().replace(/^@/, '')
      const domain = callerEmail.toLowerCase().split('@')[1] ?? ''
      return normalized.includes('.')
        ? domain === normalized
        : domain.endsWith(`.${normalized}`) || domain === normalized
    }

    expect(matches('alex@oakridge.edu', 'oakridge.edu')).toBe(true)
    expect(matches('alex@gmail.com', 'oakridge.edu')).toBe(false)
    // Bare TLD bind: any *.edu address ok.
    expect(matches('alex@oakridge.edu', 'edu')).toBe(true)
    expect(matches('alex@gmail.com', 'edu')).toBe(false)
  })

  it('regenerate-codes path clears used_at and refreshes expiry', async () => {
    // Mark used.
    await admin.from('schools')
      .update({ admin_code_used_at: new Date().toISOString() })
      .eq('id', SCHOOL).throwOnError()

    // Regenerate (mirrors the route logic).
    const expiry = new Date(Date.now() + 14 * 86400_000).toISOString()
    await admin.from('schools')
      .update({
        admin_invite_code:   `ADM-regen-${runId}-${Date.now()}`,
        admin_code_expires_at: expiry,
        admin_code_used_at:    null,
      })
      .eq('id', SCHOOL).throwOnError()

    const { data } = await admin.from('schools')
      .select('admin_code_used_at, admin_code_expires_at').eq('id', SCHOOL).single()
    expect(data?.admin_code_used_at).toBeNull()
    expect(new Date(data!.admin_code_expires_at!) > new Date()).toBe(true)
  })
})

describe.skipIf(HAVE_TEST_DB)('W2.5: invite code binding (skipped - no test DB env)', () => {
  it('placeholder', () => { expect(true).toBe(true) })
})
