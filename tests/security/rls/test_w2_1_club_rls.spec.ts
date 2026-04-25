/**
 * W2.1 — verify migration 0002_club_membership_rls.sql produces the
 * access-control matrix in docs/security/W2.1-RLS-PLAN.md §4.
 *
 * Approach: seed 8 actor-class users across 2 schools and 3 clubs in
 * `beforeAll`, then drive a parametrized assertion loop from a JSON
 * matrix mirroring the plan. Each row is one (table, verb, actor) cell;
 * the test attempts the operation with that actor's JWT and asserts
 * allow/deny.
 *
 * Closes finding C-4 (test side) from the assessment.
 *
 * Setup is identical to W1.4: needs SUPABASE_TEST_URL, _ANON_KEY,
 * _SERVICE_ROLE_KEY, _JWT_SECRET. Runs via `npm run test:rls`.
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
const SCHOOL_X = `00000000-0000-4000-8000-${'x'.repeat(8) + runId}`.replace('xxxxxxxx', '0001')
const SCHOOL_Y = `00000000-0000-4000-8000-${'y'.repeat(8) + runId}`.replace('yyyyyyyy', '0002')
const CLUB_X1 = `test-w21-${runId}-club-x1`
const CLUB_X2 = `test-w21-${runId}-club-x2`
const CLUB_Y1 = `test-w21-${runId}-club-y1`

const U = {
  superA: `test-w21-${runId}-super-a`,
  adminX: `test-w21-${runId}-admin-x`,
  adminY: `test-w21-${runId}-admin-y`,
  advisorX1: `test-w21-${runId}-advisor-x1`,
  leaderX1: `test-w21-${runId}-leader-x1`,
  memberX1: `test-w21-${runId}-member-x1`,
  userXNo: `test-w21-${runId}-user-x-no`,
  userY: `test-w21-${runId}-user-y`,
} as const

function mintJwt(sub: string): string {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600,
  })).toString('base64url')
  const sig = createHmac('sha256', JWT_SECRET!).update(`${head}.${payload}`).digest('base64url')
  return `${head}.${payload}.${sig}`
}

function clientAs(userId: string): SupabaseClient {
  return createClient(URL!, ANON!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${mintJwt(userId)}` } },
  })
}

describe.skipIf(!HAVE_TEST_DB)('W2.1: club-scoped RLS matrix', () => {
  let admin: SupabaseClient

  // Helper IDs created during seed.
  let chatX1: string, chatX2: string, chatY1: string
  let attRecX1Member: string
  let pollX1: string, pollY1: string
  let newsX1: string
  let formX1: string
  let eventPubX1: string, eventPrivX1: string
  let jrPendingX1: string

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })

    // Schools
    await admin.from('schools').insert([
      { id: SCHOOL_X, name: `RLS-W21 X ${runId}`, contact_name: 'X', contact_email: `x-${runId}@example.test`, status: 'active' },
      { id: SCHOOL_Y, name: `RLS-W21 Y ${runId}`, contact_name: 'Y', contact_email: `y-${runId}@example.test`, status: 'active' },
    ]).throwOnError()

    // Users
    await admin.from('users').insert([
      { id: U.superA,    name: 'Super A',    email: 's@x.test', role: 'superadmin', school_id: null },
      { id: U.adminX,    name: 'Admin X',    email: 'ax@x.test', role: 'admin',    school_id: SCHOOL_X },
      { id: U.adminY,    name: 'Admin Y',    email: 'ay@y.test', role: 'admin',    school_id: SCHOOL_Y },
      { id: U.advisorX1, name: 'Advisor X1', email: 'av@x.test', role: 'advisor',  school_id: SCHOOL_X },
      { id: U.leaderX1,  name: 'Leader X1',  email: 'le@x.test', role: 'student',  school_id: SCHOOL_X },
      { id: U.memberX1,  name: 'Member X1',  email: 'me@x.test', role: 'student',  school_id: SCHOOL_X },
      { id: U.userXNo,   name: 'User X-no',  email: 'un@x.test', role: 'student',  school_id: SCHOOL_X },
      { id: U.userY,     name: 'User Y',     email: 'uy@y.test', role: 'student',  school_id: SCHOOL_Y },
    ]).throwOnError()

    // Clubs
    await admin.from('clubs').insert([
      { id: CLUB_X1, name: 'Club X1', school_id: SCHOOL_X, advisor_id: U.advisorX1, created_at: new Date().toISOString() },
      { id: CLUB_X2, name: 'Club X2', school_id: SCHOOL_X, advisor_id: U.advisorX1, created_at: new Date().toISOString() },
      { id: CLUB_Y1, name: 'Club Y1', school_id: SCHOOL_Y, advisor_id: null,        created_at: new Date().toISOString() },
    ]).throwOnError()

    // Memberships in CLUB_X1
    await admin.from('memberships').insert([
      { id: `m-${runId}-1`, club_id: CLUB_X1, user_id: U.memberX1, joined_at: '2026-04-01' },
      { id: `m-${runId}-2`, club_id: CLUB_X1, user_id: U.leaderX1, joined_at: '2026-04-01' },
    ]).throwOnError()

    // Leadership in CLUB_X1
    await admin.from('leadership_positions').insert([
      { id: `lp-${runId}-1`, club_id: CLUB_X1, title: 'President', user_id: U.leaderX1 },
    ]).throwOnError()

    // Seed sample rows for SELECT tests.
    chatX1 = `chat-${runId}-x1`
    chatX2 = `chat-${runId}-x2`
    chatY1 = `chat-${runId}-y1`
    await admin.from('chat_messages').insert([
      { id: chatX1, club_id: CLUB_X1, sender_id: U.memberX1, content: 'hi', sent_at: new Date().toISOString() },
      { id: chatX2, club_id: CLUB_X2, sender_id: U.advisorX1, content: 'hi2', sent_at: new Date().toISOString() },
      { id: chatY1, club_id: CLUB_Y1, sender_id: U.userY, content: 'hiY', sent_at: new Date().toISOString() },
    ]).throwOnError()

    attRecX1Member = `att-${runId}-x1m`
    await admin.from('attendance_records').insert([
      { id: attRecX1Member, club_id: CLUB_X1, user_id: U.memberX1, meeting_date: '2026-04-10', present: true },
    ]).throwOnError()

    pollX1 = `poll-${runId}-x1`
    pollY1 = `poll-${runId}-y1`
    await admin.from('polls').insert([
      { id: pollX1, club_id: CLUB_X1, position_title: 'Lead', created_at: new Date().toISOString(), is_open: true },
      { id: pollY1, club_id: CLUB_Y1, position_title: 'LeadY', created_at: new Date().toISOString(), is_open: true },
    ]).throwOnError()
    await admin.from('poll_candidates').insert([
      { poll_id: pollX1, user_id: U.memberX1 },
      { poll_id: pollX1, user_id: U.leaderX1 },
    ]).throwOnError()

    newsX1 = `news-${runId}-x1`
    await admin.from('club_news').insert([
      { id: newsX1, club_id: CLUB_X1, title: 'N', content: 'C', author_id: U.advisorX1, created_at: new Date().toISOString() },
    ]).throwOnError()

    formX1 = `form-${runId}-x1`
    await admin.from('club_forms').insert([
      { id: formX1, club_id: CLUB_X1, title: 'F', form_type: 'survey', created_at: new Date().toISOString() },
    ]).throwOnError()

    eventPubX1 = `evp-${runId}-x1`
    eventPrivX1 = `evpriv-${runId}-x1`
    await admin.from('events').insert([
      { id: eventPubX1,  club_id: CLUB_X1, title: 'PubX1',  date: '2026-05-01', is_public: true,  created_by: U.advisorX1 },
      { id: eventPrivX1, club_id: CLUB_X1, title: 'PrivX1', date: '2026-05-02', is_public: false, created_by: U.advisorX1 },
    ]).throwOnError()

    jrPendingX1 = `jr-${runId}-x1`
    await admin.from('join_requests').insert([
      { id: jrPendingX1, club_id: CLUB_X1, user_id: U.userXNo, requested_at: new Date().toISOString(), status: 'pending' },
    ]).throwOnError()
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('chat_messages').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('attendance_records').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('attendance_sessions').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('poll_votes').delete().in('poll_id', [pollX1, pollY1])
    await admin.from('poll_candidates').delete().in('poll_id', [pollX1, pollY1])
    await admin.from('polls').delete().in('id', [pollX1, pollY1])
    await admin.from('club_news').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('form_responses').delete().in('form_id', [formX1])
    await admin.from('club_forms').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('events').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('leadership_positions').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('join_requests').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('memberships').delete().in('club_id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('clubs').delete().in('id', [CLUB_X1, CLUB_X2, CLUB_Y1])
    await admin.from('users').delete().in('id', Object.values(U))
    await admin.from('schools').delete().in('id', [SCHOOL_X, SCHOOL_Y])
  })

  // ---------------------------------------------------------------------
  // SELECT — chat_messages
  // ---------------------------------------------------------------------

  describe('chat_messages SELECT (CLUB_X1)', () => {
    const expectations: { actor: keyof typeof U; canSee: boolean }[] = [
      { actor: 'superA',    canSee: true  },
      { actor: 'adminX',    canSee: true  },
      { actor: 'advisorX1', canSee: true  },
      { actor: 'leaderX1',  canSee: true  },
      { actor: 'memberX1',  canSee: true  },
      { actor: 'userXNo',   canSee: false },
      { actor: 'adminY',    canSee: false },
      { actor: 'userY',     canSee: false },
    ]
    for (const e of expectations) {
      it(`${e.actor} ${e.canSee ? 'sees' : 'does NOT see'} the message`, async () => {
        const { data } = await clientAs(U[e.actor]).from('chat_messages').select('id').eq('id', chatX1)
        expect((data?.length ?? 0) > 0).toBe(e.canSee)
      })
    }
  })

  // ---------------------------------------------------------------------
  // SELECT — attendance_records
  // ---------------------------------------------------------------------

  describe('attendance_records SELECT (CLUB_X1, member self-row)', () => {
    const expectations: { actor: keyof typeof U; canSee: boolean }[] = [
      { actor: 'superA',    canSee: true  },
      { actor: 'adminX',    canSee: true  },
      { actor: 'advisorX1', canSee: true  },
      { actor: 'memberX1',  canSee: true  }, // own row
      { actor: 'leaderX1',  canSee: false }, // not a manager, not own row
      { actor: 'userXNo',   canSee: false },
      { actor: 'userY',     canSee: false },
    ]
    for (const e of expectations) {
      it(`${e.actor} ${e.canSee ? 'sees' : 'does NOT see'} the attendance row`, async () => {
        const { data } = await clientAs(U[e.actor]).from('attendance_records').select('id').eq('id', attRecX1Member)
        expect((data?.length ?? 0) > 0).toBe(e.canSee)
      })
    }
  })

  // ---------------------------------------------------------------------
  // SELECT — polls / poll_candidates
  // ---------------------------------------------------------------------

  describe('polls SELECT (CLUB_X1)', () => {
    const expectations: { actor: keyof typeof U; canSee: boolean }[] = [
      { actor: 'superA',    canSee: true  },
      { actor: 'adminX',    canSee: true  },
      { actor: 'advisorX1', canSee: true  },
      { actor: 'memberX1',  canSee: true  },
      { actor: 'userXNo',   canSee: false },
      { actor: 'userY',     canSee: false },
    ]
    for (const e of expectations) {
      it(`${e.actor} ${e.canSee ? 'sees' : 'does NOT see'} the poll`, async () => {
        const { data } = await clientAs(U[e.actor]).from('polls').select('id').eq('id', pollX1)
        expect((data?.length ?? 0) > 0).toBe(e.canSee)
      })
    }
  })

  // ---------------------------------------------------------------------
  // SELECT — poll_votes (secret-ballot precursor)
  // ---------------------------------------------------------------------

  describe('poll_votes SELECT secrecy', () => {
    beforeAll(async () => {
      // memberX1 votes for leaderX1 in pollX1.
      await admin.from('poll_votes').insert({
        poll_id: pollX1, candidate_user_id: U.leaderX1, voter_user_id: U.memberX1,
      }).throwOnError()
    })

    it('voter sees their own vote', async () => {
      const { data } = await clientAs(U.memberX1).from('poll_votes').select('voter_user_id').eq('poll_id', pollX1)
      expect(data?.length).toBe(1)
    })

    it('non-voter member cannot see another voter\'s identity', async () => {
      const { data } = await clientAs(U.leaderX1).from('poll_votes').select('voter_user_id').eq('poll_id', pollX1)
      expect(data?.length ?? 0).toBe(0)
    })

    it('club advisor cannot see voter identities (W2.1; staff aggregates land in W2.2)', async () => {
      const { data } = await clientAs(U.advisorX1).from('poll_votes').select('voter_user_id').eq('poll_id', pollX1)
      expect(data?.length ?? 0).toBe(0)
    })

    it('school admin cannot see voter identities (same)', async () => {
      const { data } = await clientAs(U.adminX).from('poll_votes').select('voter_user_id').eq('poll_id', pollX1)
      expect(data?.length ?? 0).toBe(0)
    })

    it('superadmin can see voter identities (god mode for IR)', async () => {
      const { data } = await clientAs(U.superA).from('poll_votes').select('voter_user_id').eq('poll_id', pollX1)
      expect(data?.length).toBe(1)
    })
  })

  // ---------------------------------------------------------------------
  // SELECT — club_news / club_forms
  // ---------------------------------------------------------------------

  describe('club_news SELECT (CLUB_X1)', () => {
    for (const [actor, canSee] of [
      ['memberX1', true],  ['advisorX1', true], ['adminX', true], ['superA', true],
      ['userXNo', false], ['userY', false], ['adminY', false],
    ] as const) {
      it(`${actor} ${canSee ? 'sees' : 'does NOT see'} news`, async () => {
        const { data } = await clientAs(U[actor]).from('club_news').select('id').eq('id', newsX1)
        expect((data?.length ?? 0) > 0).toBe(canSee)
      })
    }
  })

  describe('club_forms SELECT (CLUB_X1)', () => {
    for (const [actor, canSee] of [
      ['memberX1', true],  ['advisorX1', true], ['adminX', true], ['superA', true],
      ['userXNo', false], ['userY', false], ['adminY', false],
    ] as const) {
      it(`${actor} ${canSee ? 'sees' : 'does NOT see'} the form`, async () => {
        const { data } = await clientAs(U[actor]).from('club_forms').select('id').eq('id', formX1)
        expect((data?.length ?? 0) > 0).toBe(canSee)
      })
    }
  })

  // ---------------------------------------------------------------------
  // SELECT — memberships
  // ---------------------------------------------------------------------

  describe('memberships SELECT', () => {
    it('member sees the full roster of their own club', async () => {
      const { data } = await clientAs(U.memberX1).from('memberships').select('user_id').eq('club_id', CLUB_X1)
      expect(data?.length).toBe(2)
    })

    it('non-member sees zero memberships of a club they\'re not in', async () => {
      const { data } = await clientAs(U.userXNo).from('memberships').select('user_id').eq('club_id', CLUB_X1)
      expect(data?.length ?? 0).toBe(0)
    })

    it('non-member sees their own memberships across the platform', async () => {
      const { data } = await clientAs(U.userXNo).from('memberships').select('user_id').eq('user_id', U.userXNo)
      expect(data?.length ?? 0).toBe(0) // userXNo has no memberships seeded
    })

    it('cross-tenant: school Y user sees no school X memberships', async () => {
      const { data } = await clientAs(U.userY).from('memberships').select('user_id').eq('club_id', CLUB_X1)
      expect(data?.length ?? 0).toBe(0)
    })
  })

  // ---------------------------------------------------------------------
  // SELECT — events (HYBRID)
  // ---------------------------------------------------------------------

  describe('events SELECT (HYBRID)', () => {
    it('non-member in same school sees the public event', async () => {
      const { data } = await clientAs(U.userXNo).from('events').select('id').eq('id', eventPubX1)
      expect(data?.length).toBe(1)
    })

    it('non-member in same school does NOT see the private event', async () => {
      const { data } = await clientAs(U.userXNo).from('events').select('id').eq('id', eventPrivX1)
      expect(data?.length ?? 0).toBe(0)
    })

    it('member sees both public and private events', async () => {
      const { data } = await clientAs(U.memberX1).from('events').select('id').in('id', [eventPubX1, eventPrivX1])
      expect(data?.length).toBe(2)
    })

    it('cross-tenant: school Y user sees neither', async () => {
      const { data } = await clientAs(U.userY).from('events').select('id').in('id', [eventPubX1, eventPrivX1])
      expect(data?.length ?? 0).toBe(0)
    })
  })

  // ---------------------------------------------------------------------
  // SELECT — join_requests
  // ---------------------------------------------------------------------

  describe('join_requests SELECT', () => {
    it('staff sees the pending request', async () => {
      for (const actor of ['advisorX1', 'adminX', 'superA'] as const) {
        const { data } = await clientAs(U[actor]).from('join_requests').select('id').eq('id', jrPendingX1)
        expect(data?.length, actor).toBe(1)
      }
    })

    it('the requester sees their own request', async () => {
      const { data } = await clientAs(U.userXNo).from('join_requests').select('id').eq('id', jrPendingX1)
      expect(data?.length).toBe(1)
    })

    it('an unrelated student in the same school does NOT see it', async () => {
      const { data } = await clientAs(U.memberX1).from('join_requests').select('id').eq('id', jrPendingX1)
      expect(data?.length ?? 0).toBe(0)
    })
  })

  // ---------------------------------------------------------------------
  // INSERT cross-tenant negative cases (a sample, not exhaustive)
  // ---------------------------------------------------------------------

  describe('cross-tenant INSERT denials', () => {
    it('school Y user cannot insert chat into school X club', async () => {
      const { error } = await clientAs(U.userY).from('chat_messages').insert({
        id: `cross-${runId}-1`, club_id: CLUB_X1, sender_id: U.userY, content: 'pwn', sent_at: new Date().toISOString(),
      })
      expect(error).not.toBeNull()
    })

    it('school Y user cannot insert membership into school X club', async () => {
      const { error } = await clientAs(U.userY).from('memberships').insert({
        id: `crossm-${runId}-1`, club_id: CLUB_X1, user_id: U.userY, joined_at: '2026-04-25',
      })
      expect(error).not.toBeNull()
    })

    it('non-member cannot vote in another club\'s poll', async () => {
      const { error } = await clientAs(U.userY).from('poll_votes').insert({
        poll_id: pollX1, candidate_user_id: U.memberX1, voter_user_id: U.userY,
      })
      expect(error).not.toBeNull()
    })
  })

  // ---------------------------------------------------------------------
  // INSERT positive cases
  // ---------------------------------------------------------------------

  describe('member-only INSERT positive cases', () => {
    it('member can post chat to their own club', async () => {
      const id = `chat-pos-${runId}-1`
      const { error } = await clientAs(U.memberX1).from('chat_messages').insert({
        id, club_id: CLUB_X1, sender_id: U.memberX1, content: 'present', sent_at: new Date().toISOString(),
      })
      expect(error, error?.message).toBeNull()
      // Cleanup.
      await admin.from('chat_messages').delete().eq('id', id)
    })

    it('member can vote in their club\'s open poll', async () => {
      // Use a fresh poll because seed already had memberX1 vote.
      const fresh = `poll-fresh-${runId}`
      await admin.from('polls').insert({
        id: fresh, club_id: CLUB_X1, position_title: 'fresh', created_at: new Date().toISOString(), is_open: true,
      }).throwOnError()
      await admin.from('poll_candidates').insert({ poll_id: fresh, user_id: U.leaderX1 }).throwOnError()
      const { error } = await clientAs(U.memberX1).from('poll_votes').insert({
        poll_id: fresh, candidate_user_id: U.leaderX1, voter_user_id: U.memberX1,
      })
      expect(error, error?.message).toBeNull()
      await admin.from('poll_votes').delete().eq('poll_id', fresh)
      await admin.from('poll_candidates').delete().eq('poll_id', fresh)
      await admin.from('polls').delete().eq('id', fresh)
    })
  })
})

describe.skipIf(HAVE_TEST_DB)('W2.1: club RLS matrix (skipped - no test DB env)', () => {
  it('would test club RLS matrix if SUPABASE_TEST_* were set', () => {
    expect(true).toBe(true)
  })
})
