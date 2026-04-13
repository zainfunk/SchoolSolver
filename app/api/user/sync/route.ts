import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/sync
 *
 * Called by MockAuthProvider on sign-in to reliably resolve the user's
 * school context.  Uses the service-role key so RLS cannot block the read.
 *
 * 1. Upserts the user row (insert-only: won't overwrite an existing role).
 * 2. Reads the authoritative role + school from the DB.
 * 3. If the Clerk publicMetadata.role is stale, patches it to match the DB.
 * 4. Returns { role, schoolId, schoolName, schoolStatus, contactName,
 *      contactEmail, setupCompletedAt }.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  // Fetch Clerk user info for name/email
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const name = clerkUser.fullName ?? clerkUser.username ?? 'New User'
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''
  const clerkRole = (clerkUser.publicMetadata?.role as string) || undefined

  // Ensure user row exists (don't overwrite existing role/school)
  await db.from('users').upsert(
    { id: userId, name, email, role: clerkRole ?? 'student' },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  // Read the authoritative role and school from the DB
  const { data: userData } = await db
    .from('users')
    .select('role, school_id')
    .eq('id', userId)
    .maybeSingle()

  const dbRole = userData?.role ?? clerkRole ?? 'student'
  const schoolId = userData?.school_id ?? null

  // If Clerk metadata is stale, fix it
  if (clerkRole !== dbRole) {
    try {
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { ...clerkUser.publicMetadata, role: dbRole },
      })
    } catch (e) {
      console.warn('sync: failed to patch Clerk metadata', e)
    }
  }

  // If no school, return early
  if (!schoolId) {
    return NextResponse.json({ role: dbRole })
  }

  // Fetch school details
  const { data: school } = await db
    .from('schools')
    .select('name, contact_name, contact_email, status, setup_completed_at')
    .eq('id', schoolId)
    .maybeSingle()

  return NextResponse.json({
    role: dbRole,
    schoolId: school ? schoolId : null,
    schoolName: school?.name ?? null,
    schoolStatus: school?.status ?? null,
    contactName: school?.contact_name ?? null,
    contactEmail: school?.contact_email ?? null,
    setupCompletedAt: school?.setup_completed_at ?? null,
  })
}
