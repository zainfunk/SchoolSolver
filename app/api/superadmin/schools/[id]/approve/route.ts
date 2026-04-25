import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode, generateSetupToken, setupTokenExpiresAt } from '@/lib/schools-store'

async function requireSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return null

  // Source of truth: users.role in the DB. Fall back to Clerk metadata if
  // the row hasn't been created yet (shouldn't happen post-/api/user/sync).
  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (userRow?.role === 'superadmin') return userId

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  if (user.publicMetadata?.role === 'superadmin') return userId

  return null
}

/**
 * POST /api/superadmin/schools/[id]/approve
 *
 * W2.3 (finding C-3): completes the pending-onboarding flow. In addition
 * to the previous behavior (status -> active, generate invite codes,
 * generate setup link), this route now ALSO promotes the user named in
 * `schools.requested_admin_user_id` to role='admin' and updates their
 * Clerk publicMetadata to match.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  const { data: school } = await db
    .from('schools')
    .select('id, status, requested_admin_user_id')
    .eq('id', id)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 })
  }

  if (school.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending schools can be approved' }, { status: 409 })
  }

  const studentCode = generateInviteCode('STU')
  const adminCode = generateInviteCode('ADM')
  const advisorCode = generateInviteCode('ADV')
  const token = generateSetupToken()
  const tokenExpiry = setupTokenExpiresAt()

  // Conditional update protects against a concurrent approve.
  const { data, error } = await db
    .from('schools')
    .update({
      status: 'active',
      student_invite_code: studentCode,
      admin_invite_code: adminCode,
      advisor_invite_code: advisorCode,
      setup_token: token,
      setup_token_expires_at: tokenExpiry,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to approve school' }, { status: 500 })

  // Promote the requester to admin if there is one. (Older pending rows
  // created before W2.3 may not have requested_admin_user_id set; in that
  // case we just leave roles alone -- the admin invite code is the
  // fallback path.)
  let promotedAdminId: string | null = null
  if (school.requested_admin_user_id) {
    promotedAdminId = school.requested_admin_user_id
    const { error: roleErr } = await db
      .from('users')
      .update({ role: 'admin' })
      .eq('id', promotedAdminId)
      .eq('school_id', id) // pinned to this school

    if (roleErr) {
      console.error('approve: role flip failed', roleErr)
      // Don't 500 the whole flow; the school is already active. Return
      // a partial success so the operator can retry the role flip.
      return NextResponse.json({
        school: data,
        setupLink: `/setup/${token}`,
        warning: 'School approved but admin role promotion failed; promote the user manually.',
      })
    }

    // Sync Clerk metadata best-effort.
    try {
      const client = await clerkClient()
      const target = await client.users.getUser(promotedAdminId)
      await client.users.updateUserMetadata(promotedAdminId, {
        publicMetadata: { ...target.publicMetadata, role: 'admin' },
      })
    } catch (metaErr) {
      console.warn('approve: clerk metadata sync warning', metaErr)
    }
  }

  return NextResponse.json({
    school: data,
    setupLink: `/setup/${token}`,
    promotedAdminId,
  })
}
