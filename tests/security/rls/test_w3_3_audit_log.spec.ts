/**
 * W3.3 — verify the audit_log table is append-only and writeable only
 * via service_role (or the SECURITY DEFINER `app.audit` function).
 *
 * Closes finding W3.3.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHmac, randomUUID } from 'node:crypto'

const URL = process.env.SUPABASE_TEST_URL
const ANON = process.env.SUPABASE_TEST_ANON_KEY
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET

const HAVE_TEST_DB = !!(URL && ANON && SERVICE && JWT_SECRET)

const runId = randomUUID().slice(0, 8)
const SCHOOL = `00000000-0000-4000-8000-${runId.padEnd(12, '0').slice(0, 12)}`
const ADMIN_USER = `test-w33-${runId}-admin`
const STUDENT_USER = `test-w33-${runId}-stu`

function mintJwt(sub: string): string {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })).toString('base64url')
  const sig = createHmac('sha256', JWT_SECRET!).update(`${head}.${payload}`).digest('base64url')
  return `${head}.${payload}.${sig}`
}

function clientAs(userId: string): SupabaseClient {
  return createClient(URL!, ANON!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${mintJwt(userId)}` } },
  })
}

describe.skipIf(!HAVE_TEST_DB)('W3.3: audit_log is append-only', () => {
  let admin: SupabaseClient
  let insertedId: number | undefined

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })

    await admin.from('schools').insert({
      id: SCHOOL, name: `RLS-W33 ${runId}`, contact_name: 'C', contact_email: `c-${runId}@example.test`, status: 'active',
    }).throwOnError()
    await admin.from('users').insert([
      { id: ADMIN_USER,   name: 'A', email: 'a@x.test', role: 'admin',   school_id: SCHOOL },
      { id: STUDENT_USER, name: 'S', email: 's@x.test', role: 'student', school_id: SCHOOL },
    ]).throwOnError()

    const { data, error } = await admin.from('audit_log').insert({
      actor_user_id: ADMIN_USER,
      actor_role: 'admin',
      action: 'user.role_changed',
      target_table: 'users',
      target_id: STUDENT_USER,
      before_jsonb: { role: 'student' },
      after_jsonb:  { role: 'advisor' },
    }).select('id').single()
    expect(error, error?.message).toBeNull()
    insertedId = data?.id
  })

  afterAll(async () => {
    if (!admin) return
    if (insertedId) await admin.from('audit_log').delete().eq('id', insertedId) // expected to fail; cleanup attempt only
    await admin.from('users').delete().in('id', [ADMIN_USER, STUDENT_USER])
    await admin.from('schools').delete().eq('id', SCHOOL)
  })

  it('service_role can INSERT but not UPDATE or DELETE', async () => {
    expect(insertedId).toBeDefined()

    const upd = await admin.from('audit_log').update({ action: 'tampered' }).eq('id', insertedId!)
    expect(upd.error, 'service_role UPDATE must be revoked').not.toBeNull()

    const del = await admin.from('audit_log').delete().eq('id', insertedId!)
    expect(del.error, 'service_role DELETE must be revoked').not.toBeNull()
  })

  it('school admin can SELECT audit rows', async () => {
    const { data } = await clientAs(ADMIN_USER).from('audit_log').select('id, action').eq('id', insertedId!)
    expect(data?.length).toBe(1)
  })

  it('regular student cannot SELECT audit rows (RLS)', async () => {
    const { data } = await clientAs(STUDENT_USER).from('audit_log').select('id').eq('id', insertedId!)
    expect(data?.length ?? 0).toBe(0)
  })

  it('authenticated user cannot INSERT audit rows directly', async () => {
    const { error } = await clientAs(ADMIN_USER).from('audit_log').insert({
      actor_user_id: ADMIN_USER,
      action: 'user.role_changed',
      target_table: 'users',
      target_id: STUDENT_USER,
    })
    expect(error, 'authenticated INSERT must be denied by RLS WITH CHECK (false)').not.toBeNull()
  })

  it('app.audit() RPC works from authenticated context', async () => {
    const { error } = await clientAs(ADMIN_USER).rpc('audit', {
      p_action: 'school.settings_changed',
      p_target_table: 'admin_settings',
      p_target_id: SCHOOL,
      p_before: { hours_tracking_enabled: true },
      p_after:  { hours_tracking_enabled: false },
    })
    expect(error, error?.message).toBeNull()

    // Confirm a row landed.
    const { data } = await admin.from('audit_log').select('id, actor_user_id, action')
      .eq('action', 'school.settings_changed')
      .eq('target_id', SCHOOL)
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle()
    expect(data?.actor_user_id).toBe(ADMIN_USER)
  })
})
