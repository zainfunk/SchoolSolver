import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import {
  generateInviteCode,
  generateSetupToken,
  rowToSchool,
  setupTokenExpiresAt,
} from '@/lib/schools-store'
import { sanitizeText } from '@/lib/sanitize'
import { audit } from '@/lib/audit'

async function requireSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return null

  // Check DB first (source of truth), then fall back to Clerk metadata
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

export async function GET(_request: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('schools')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch schools' }, { status: 500 })

  return NextResponse.json({ schools: data.map(rowToSchool) })
}

/**
 * POST /api/superadmin/schools
 *
 * Superadmin-driven school creation. Skips the public /onboard pending-review
 * flow: the school is created in status='active' immediately with invite codes
 * and a setup token already issued. No requested_admin_user_id is set (no
 * specific user is bound yet) — the school's first admin claims their account
 * later by signing up with the admin invite code.
 */
export async function POST(request: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { name?: string; district?: string; contactName?: string; contactEmail?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = body.name?.trim()
  const contactName = body.contactName?.trim()
  const contactEmail = body.contactEmail?.trim().toLowerCase()
  const district = body.district?.trim()

  if (!name || !contactName || !contactEmail) {
    return NextResponse.json({ error: 'name, contactName, and contactEmail are required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: 'contactEmail is not a valid email' }, { status: 400 })
  }

  const db = createServiceClient()

  const studentCode = generateInviteCode('STU')
  const adminCode = generateInviteCode('ADM')
  const advisorCode = generateInviteCode('ADV')
  const token = generateSetupToken()
  const tokenExpiry = setupTokenExpiresAt()

  const { data, error } = await db
    .from('schools')
    .insert({
      name: sanitizeText(name),
      district: district ? sanitizeText(district) : null,
      contact_name: sanitizeText(contactName),
      contact_email: contactEmail,
      status: 'active',
      student_invite_code: studentCode,
      admin_invite_code: adminCode,
      advisor_invite_code: advisorCode,
      setup_token: token,
      setup_token_expires_at: tokenExpiry,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('superadmin school create error', error)
    return NextResponse.json({ error: 'Failed to create school' }, { status: 500 })
  }

  await audit({
    action: 'school.created',
    targetTable: 'schools',
    targetId: data.id,
    after: { name: data.name, contactEmail: data.contact_email, status: 'active' },
    actorUserId: userId,
    actorRole: 'superadmin',
    request,
  })

  return NextResponse.json({
    school: rowToSchool(data),
    setupLink: `/setup/${token}`,
  }, { status: 201 })
}
