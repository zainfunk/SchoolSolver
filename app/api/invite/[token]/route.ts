import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode } from '@/lib/schools-store'
import { sanitizeText } from '@/lib/sanitize'

// GET — validate token and return invite data
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const db = createServiceClient()

  const { data: invite } = await db
    .from('school_invites')
    .select('id, email, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: 'This invite link has already been used' }, { status: 410 })
  }

  return NextResponse.json({ email: invite.email })
}

/**
 * POST — claim the invite. Requires the caller to be signed in: the
 * authenticated user becomes admin of the new school. The school is
 * created in status='active' immediately (the superadmin already
 * vouched for the recipient by issuing the invite).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json(
      { error: 'You must be signed in to claim this invite' },
      { status: 401 },
    )
  }

  const { token } = await params
  const db = createServiceClient()

  const { data: invite } = await db
    .from('school_invites')
    .select('id, email, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: 'This invite link has already been used' }, { status: 410 })
  }

  // Refuse if the caller is already a platform superadmin — they manage
  // the platform, not a single school, and silently rebinding them as a
  // school admin would lose their superadmin role.
  const { data: existingUser } = await db
    .from('users')
    .select('role, school_id')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser?.role === 'superadmin') {
    return NextResponse.json(
      { error: 'Sign out of your superadmin account and claim this invite from a fresh account.' },
      { status: 409 },
    )
  }

  // Refuse if the caller is already enrolled in a school. We can't have
  // one user belong to two schools.
  if (existingUser?.school_id) {
    return NextResponse.json(
      { error: 'You are already enrolled in a school. Use a different account to claim this invite.' },
      { status: 409 },
    )
  }

  const body = await request.json()
  const { name, district, contactName } = body

  if (!name || !contactName) {
    return NextResponse.json({ error: 'School name and contact name are required' }, { status: 400 })
  }

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)

  // Make sure the user row exists before we point school columns at it.
  // /api/user/sync would create it on first dashboard hit, but a fresh
  // claimer who came straight from sign-up may not have triggered that yet.
  await db.from('users').upsert(
    {
      id: userId,
      name: clerkUser.fullName ?? clerkUser.username ?? contactName.trim(),
      email: clerkUser.primaryEmailAddress?.emailAddress ?? invite.email,
      role: 'student',
      school_id: null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )

  const studentCode = generateInviteCode('STU')
  const adminCode = generateInviteCode('ADM')
  const advisorCode = generateInviteCode('ADV')

  const { data: school, error } = await db
    .from('schools')
    .insert({
      name: sanitizeText(name.trim()),
      district: district?.trim() ? sanitizeText(district.trim()) : null,
      contact_name: sanitizeText(contactName.trim()),
      contact_email: invite.email,
      status: 'active',
      student_invite_code: studentCode,
      admin_invite_code: adminCode,
      advisor_invite_code: advisorCode,
    })
    .select()
    .single()

  if (error || !school) {
    console.error('invite claim: school create error', error)
    return NextResponse.json({ error: 'Failed to create school' }, { status: 500 })
  }

  // Promote the claimer to admin and bind them to the new school.
  const { error: userErr } = await db
    .from('users')
    .update({ role: 'admin', school_id: school.id })
    .eq('id', userId)

  if (userErr) {
    console.error('invite claim: admin role assignment failed', userErr)
    return NextResponse.json({
      schoolName: school.name,
      studentInviteCode: studentCode,
      adminInviteCode: adminCode,
      advisorInviteCode: advisorCode,
      warning: 'School created, but we could not finalize your admin role. Contact support.',
    })
  }

  // Best-effort Clerk metadata sync so role=admin shows up everywhere
  // immediately. Failure is logged but not fatal — the DB is the source of truth.
  try {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...clerkUser.publicMetadata, role: 'admin' },
    })
  } catch (metaErr) {
    console.warn('invite claim: clerk metadata sync warning', metaErr)
  }

  // Mark invite used last — if anything above failed, the invite is still
  // claimable for a retry.
  await db
    .from('school_invites')
    .update({ used_at: new Date().toISOString(), school_id: school.id })
    .eq('id', invite.id)

  return NextResponse.json({
    schoolName: school.name,
    schoolId: school.id,
    studentInviteCode: studentCode,
    adminInviteCode: adminCode,
    advisorInviteCode: advisorCode,
  })
}
