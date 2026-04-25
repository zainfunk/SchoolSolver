/**
 * W1.4 — verify the migration in
 *   supabase/migrations/0001_users_rls_lockdown.sql
 * actually prevents the privilege escalation described in finding C-5.
 *
 * SETUP (one-time):
 *   1. Apply schema.sql + 0001_users_rls_lockdown.sql to a test DB.
 *      Local Supabase: `supabase db reset && supabase db push`.
 *   2. Set env vars (in `.env.test.local` or your shell):
 *        SUPABASE_TEST_URL=http://localhost:54321
 *        SUPABASE_TEST_ANON_KEY=<anon key from supabase status>
 *        SUPABASE_TEST_SERVICE_ROLE_KEY=<service role key>
 *        SUPABASE_TEST_JWT_SECRET=<from `supabase status` -> JWT secret>
 *   3. Run: `npm run test:rls`  (added in this commit)
 *
 * The test does its own seeding via service-role and cleans up afterwards.
 *
 * Closes finding C-5 from docs/security/ClubIt-Security-Assessment.md.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHmac, randomUUID } from 'node:crypto'

const URL = process.env.SUPABASE_TEST_URL
const ANON = process.env.SUPABASE_TEST_ANON_KEY
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET

const HAVE_TEST_DB = !!(URL && ANON && SERVICE && JWT_SECRET)

// Helper: mint a Supabase-style HS256 JWT carrying `sub` claim. Supabase
// PostgREST validates the signature with SUPABASE_TEST_JWT_SECRET and
// makes the `sub` available to RLS via auth.jwt()->>'sub'.
function mintJwt(sub: string, role: 'authenticated' | 'service_role' = 'authenticated'): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub,
    role,
    aud: 'authenticated',
    iat: now,
    exp: now + 3600,
  }
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64(header)
  const body = b64(payload)
  const sig = createHmac('sha256', JWT_SECRET!)
    .update(`${head}.${body}`)
    .digest('base64url')
  return `${head}.${body}.${sig}`
}

function clientAs(userId: string): SupabaseClient {
  return createClient(URL!, ANON!, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${mintJwt(userId)}` },
    },
  })
}

const testRunId = randomUUID().slice(0, 8)
// Use distinctive IDs so cleanup is unambiguous.
const STUDENT_X = `test-w14-${testRunId}-student-x`
const STUDENT_Y = `test-w14-${testRunId}-student-y`
const SCHOOL_X = `test-w14-${testRunId}-school-x`
const SCHOOL_Y = `test-w14-${testRunId}-school-y`

describe.skipIf(!HAVE_TEST_DB)('W1.4: users RLS lockdown', () => {
  let admin: SupabaseClient

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })

    // Seed two schools and two students (one per school).
    await admin.from('schools').insert([
      {
        id: SCHOOL_X, name: `RLS test school X ${testRunId}`,
        contact_name: 'X', contact_email: `x-${testRunId}@example.test`,
        status: 'active',
      },
      {
        id: SCHOOL_Y, name: `RLS test school Y ${testRunId}`,
        contact_name: 'Y', contact_email: `y-${testRunId}@example.test`,
        status: 'active',
      },
    ]).throwOnError()

    await admin.from('users').insert([
      { id: STUDENT_X, name: 'Student X', email: `x@example.test`, role: 'student', school_id: SCHOOL_X },
      { id: STUDENT_Y, name: 'Student Y', email: `y@example.test`, role: 'student', school_id: SCHOOL_Y },
    ]).throwOnError()
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('users').delete().in('id', [STUDENT_X, STUDENT_Y])
    await admin.from('schools').delete().in('id', [SCHOOL_X, SCHOOL_Y])
  })

  it('rejects self-promotion to admin via direct UPDATE', async () => {
    const c = clientAs(STUDENT_X)
    const { error } = await c
      .from('users')
      .update({ role: 'admin' })
      .eq('id', STUDENT_X)
    expect(error, 'expected the trigger to refuse the role change').not.toBeNull()
    // Verify role unchanged in DB.
    const { data } = await admin.from('users').select('role').eq('id', STUDENT_X).single()
    expect(data?.role).toBe('student')
  })

  it('rejects self-promotion to superadmin via direct UPDATE', async () => {
    const c = clientAs(STUDENT_X)
    const { error } = await c
      .from('users')
      .update({ role: 'superadmin' })
      .eq('id', STUDENT_X)
    expect(error).not.toBeNull()
  })

  it('rejects school_id reassignment via direct UPDATE', async () => {
    const c = clientAs(STUDENT_X)
    const { error } = await c
      .from('users')
      .update({ school_id: SCHOOL_Y })
      .eq('id', STUDENT_X)
    expect(error).not.toBeNull()
    const { data } = await admin.from('users').select('school_id').eq('id', STUDENT_X).single()
    expect(data?.school_id).toBe(SCHOOL_X)
  })

  it('allows display-name update on own row', async () => {
    const c = clientAs(STUDENT_X)
    const { error } = await c
      .from('users')
      .update({ name: 'Renamed Self' })
      .eq('id', STUDENT_X)
    expect(error, error?.message).toBeNull()
    const { data } = await admin.from('users').select('name').eq('id', STUDENT_X).single()
    expect(data?.name).toBe('Renamed Self')
    // Restore for downstream tests.
    await admin.from('users').update({ name: 'Student X' }).eq('id', STUDENT_X)
  })

  it('rejects update of another user\'s row', async () => {
    const c = clientAs(STUDENT_X)
    const { error, data } = await c
      .from('users')
      .update({ name: 'Hijacked' })
      .eq('id', STUDENT_Y)
      .select()
    // RLS should yield zero rows (USING clause filters out the target),
    // OR an error. Either is acceptable; what's not acceptable is the
    // target's name actually changing.
    expect(error || (data && data.length === 0)).toBeTruthy()
    const { data: y } = await admin.from('users').select('name').eq('id', STUDENT_Y).single()
    expect(y?.name).toBe('Student Y')
  })

  it('rejects insert with role=admin (forces role=student)', async () => {
    const fakeId = `test-w14-${testRunId}-rogue`
    const c = clientAs(fakeId)
    const { error } = await c
      .from('users')
      .insert({
        id: fakeId, name: 'Rogue', email: 'rogue@example.test',
        role: 'admin', school_id: null,
      })
    expect(error, 'expected RLS WITH CHECK to refuse role=admin insert').not.toBeNull()

    // Cleanup if it somehow landed.
    await admin.from('users').delete().eq('id', fakeId)
  })

  it('rejects insert with school_id pre-populated (forces school_id=null)', async () => {
    const fakeId = `test-w14-${testRunId}-rogue2`
    const c = clientAs(fakeId)
    const { error } = await c
      .from('users')
      .insert({
        id: fakeId, name: 'Rogue', email: 'rogue@example.test',
        role: 'student', school_id: SCHOOL_X,
      })
    expect(error, 'expected RLS WITH CHECK to refuse pre-populated school_id').not.toBeNull()

    await admin.from('users').delete().eq('id', fakeId)
  })

  it('allows the canonical first-login self-insert (student, no school)', async () => {
    const fakeId = `test-w14-${testRunId}-fresh`
    const c = clientAs(fakeId)
    const { error } = await c
      .from('users')
      .insert({
        id: fakeId, name: 'Fresh User', email: 'fresh@example.test',
        role: 'student', school_id: null,
      })
    expect(error, error?.message).toBeNull()

    await admin.from('users').delete().eq('id', fakeId)
  })

  it('service_role still bypasses the trigger (so /api/school/users/[id]/role works)', async () => {
    // Use the service-role client to update STUDENT_X's role.
    const { error } = await admin.from('users').update({ role: 'advisor' }).eq('id', STUDENT_X)
    expect(error, error?.message).toBeNull()
    const { data } = await admin.from('users').select('role').eq('id', STUDENT_X).single()
    expect(data?.role).toBe('advisor')
    // Restore.
    await admin.from('users').update({ role: 'student' }).eq('id', STUDENT_X)
  })
})

describe.skipIf(HAVE_TEST_DB)('W1.4: users RLS lockdown (skipped — no test DB env)', () => {
  it('would test users RLS if SUPABASE_TEST_URL and friends were set', () => {
    // This is a placeholder so `npm test` shows the suite exists but is
    // skipped, rather than silently passing zero tests.
    console.warn(
      '[W1.4] skipped: set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, ' +
      'SUPABASE_TEST_SERVICE_ROLE_KEY, SUPABASE_TEST_JWT_SECRET in .env.test.local ' +
      'and apply supabase/migrations/0001_users_rls_lockdown.sql to your test DB.',
    )
    expect(true).toBe(true)
  })
})
