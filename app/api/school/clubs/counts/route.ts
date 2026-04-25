import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/school/clubs/counts
 *
 * Returns `{ counts: { [clubId]: number } }` for every club in the caller's
 * school. Exists because after migration 0002_club_membership_rls.sql, the
 * `memberships` SELECT policy hides individual rows from non-members of a
 * club -- which would have made the explore-clubs "12 members" count read
 * zero for any club the user wasn't already in.
 *
 * Uses the service-role client so the count is correct regardless of the
 * caller's membership graph. The response only contains aggregate counts
 * and club IDs; no member identities, names, or roles. The endpoint is
 * documented as service-role in docs/security/W2.4-SERVICE-ROLE-INVENTORY.md.
 *
 * Closes the UX side effect flagged in docs/security/W2.1-RLS-PLAN.md §6.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // Resolve the caller's school. We refuse to answer for users who don't
  // belong to a school -- the count is school-scoped.
  const { data: caller } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()

  if (!caller?.school_id) {
    return NextResponse.json({ counts: {} })
  }

  // Find all club IDs in the school, then count memberships per club.
  const { data: clubs } = await db
    .from('clubs')
    .select('id')
    .eq('school_id', caller.school_id)

  const clubIds = (clubs ?? []).map((c) => c.id)
  if (clubIds.length === 0) {
    return NextResponse.json({ counts: {} })
  }

  const { data: memberships } = await db
    .from('memberships')
    .select('club_id')
    .in('club_id', clubIds)

  const counts: Record<string, number> = {}
  for (const id of clubIds) counts[id] = 0
  for (const m of memberships ?? []) {
    counts[m.club_id] = (counts[m.club_id] ?? 0) + 1
  }

  return NextResponse.json({ counts })
}
