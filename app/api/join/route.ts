import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import type { Role } from '@/types'

/**
 * POST /api/join
 *
 * W2.5: invite codes are now bound to identity and time.
 *  - Single-use enforcement on admin/advisor codes (consumed at first
 *    redemption; subsequent attempts return 410 Gone).
 *  - Optional email-domain binding (admin can require codes to be
 *    redeemed from "@school.edu" addresses).
 *  - Existing expiry check stays in place.
 *
 * Service-role usage justified per W2.4-SERVICE-ROLE-INVENTORY.md row 6
 * (writes role + school_id, which the W1.4 trigger blocks for
 * non-service-role callers).
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const { success, retryAfter } = rateLimit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter },
      { status: 429 }
    )
  }

  const { code } = await request.json()
  if (!code) return NextResponse.json({ error: 'Invite code required' }, { status: 400 })

  // base64url-bodied codes are case-sensitive; trim only.
  const normalised = (code as string).trim()
  const db = createServiceClient()

  // Pull every column we may consult; some are added by 0005 and may
  // not be present on older snapshots, but Supabase tolerates missing
  // columns by returning undefined.
  const cols = 'id, name, status, student_invite_code, admin_invite_code, advisor_invite_code, student_code_expires_at, admin_code_expires_at, advisor_code_expires_at, student_code_email_domain, admin_code_email_domain, advisor_code_email_domain, admin_code_used_at, advisor_code_used_at'

  const [{ data: byStudent }, { data: byAdmin }, { data: byAdvisor }] = await Promise.all([
    db.from('schools').select(cols).eq('student_invite_code', normalised).maybeSingle(),
    db.from('schools').select(cols).eq('admin_invite_code', normalised).maybeSingle(),
    db.from('schools').select(cols).eq('advisor_invite_code', normalised).maybeSingle(),
  ])

  const school = byStudent ?? byAdmin ?? byAdvisor
  if (!school) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not currently active' }, { status: 403 })
  }

  const isAdminCode = school.admin_invite_code === normalised
  const isAdvisorCode = school.advisor_invite_code === normalised
  const isStudentCode = school.student_invite_code === normalised

  // Per-code-type expiry, used_at, domain bind.
  const sr = school as Record<string, unknown>
  const matchedExpiresAt = isAdminCode
    ? (sr.admin_code_expires_at as string | null | undefined)
    : isAdvisorCode
      ? (sr.advisor_code_expires_at as string | null | undefined)
      : (sr.student_code_expires_at as string | null | undefined)
  const matchedUsedAt = isAdminCode
    ? (sr.admin_code_used_at as string | null | undefined)
    : isAdvisorCode
      ? (sr.advisor_code_used_at as string | null | undefined)
      : null
  const matchedDomain = isAdminCode
    ? (sr.admin_code_email_domain as string | null | undefined)
    : isAdvisorCode
      ? (sr.advisor_code_email_domain as string | null | undefined)
      : (sr.student_code_email_domain as string | null | undefined)

  if (matchedExpiresAt && new Date(matchedExpiresAt) < new Date()) {
    return NextResponse.json(
      { error: 'This invite code has expired. Ask your administrator for a new one.' },
      { status: 403 }
    )
  }

  // Single-use for admin/advisor codes: if used_at is set, it's gone.
  if ((isAdminCode || isAdvisorCode) && matchedUsedAt) {
    return NextResponse.json(
      { error: 'This invite code has already been used. Ask your administrator to issue a new one.' },
      { status: 410 }
    )
  }

  // Resolve caller email up front (also needed for domain check below).
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const callerEmail = (clerkUser.primaryEmailAddress?.emailAddress ?? '').toLowerCase()

  // Domain bind: if the school configured a domain for this code class,
  // refuse callers whose primary email doesn't match. Format: either a
  // bare TLD ("edu") or a full "@oakridge.edu" -- both are accepted.
  if (matchedDomain) {
    const required = matchedDomain.toLowerCase().replace(/^@/, '')
    const callerDomain = callerEmail.split('@')[1] ?? ''
    const matches = required.includes('.')
      ? callerDomain === required           // full domain bind
      : callerDomain.endsWith(`.${required}`) || callerDomain === required // tld bind
    if (!matches) {
      return NextResponse.json(
        { error: `This code requires an email at @${required}. Sign in with that address and try again.` },
        { status: 403 }
      )
    }
  }

  const incomingRole: Role = isAdminCode ? 'admin' : isAdvisorCode ? 'advisor' : 'student'

  const { data: existingUser } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser?.school_id && existingUser.school_id !== school.id) {
    const { data: currentSchool } = await db
      .from('schools')
      .select('name')
      .eq('id', existingUser.school_id)
      .maybeSingle()

    return NextResponse.json(
      {
        error: `You are already enrolled in ${currentSchool?.name ?? 'another school'}. School switching is not supported yet.`,
      },
      { status: 409 }
    )
  }

  const name = clerkUser.fullName ?? clerkUser.username ?? existingUser?.role ?? 'New User'

  // Assign user to this school and persist the promoted role.
  const { error } = await db
    .from('users')
    .upsert(
      { id: userId, name, email: callerEmail, school_id: school.id, role: incomingRole },
      { onConflict: 'id' }
    )

  if (error) {
    console.error('join upsert error', error)
    return NextResponse.json({ error: 'Failed to save your school role. Please try the code again.' }, { status: 500 })
  }

  // Mark single-use codes as consumed AFTER the role write succeeds, with
  // an UPDATE that's idempotent on the used_at field. The condition
  // ensures we only set used_at if it's still NULL, so two concurrent
  // redeemers can't both succeed.
  if (isAdminCode) {
    const { error: useErr } = await db
      .from('schools')
      .update({ admin_code_used_at: new Date().toISOString() })
      .eq('id', school.id)
      .is('admin_code_used_at', null)
    if (useErr) console.warn('join: admin_code_used_at write failed', useErr)
  } else if (isAdvisorCode) {
    const { error: useErr } = await db
      .from('schools')
      .update({ advisor_code_used_at: new Date().toISOString() })
      .eq('id', school.id)
      .is('advisor_code_used_at', null)
    if (useErr) console.warn('join: advisor_code_used_at write failed', useErr)
  }

  try {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...clerkUser.publicMetadata, role: incomingRole },
    })
  } catch (metadataError) {
    console.warn('join metadata sync warning', metadataError)
  }

  return NextResponse.json({
    schoolId: school.id,
    schoolName: school.name,
    schoolStatus: school.status,
    role: incomingRole,
  })
}
