import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { awardCheckInXp } from '@/lib/rewards/evaluate'
import { DEFAULT_MEETING_MINUTES } from '@/lib/rewards/hours'

export const dynamic = 'force-dynamic'

// POST { clubId, durationMinutes, targetUserId? } — awards XP for a successful
// check-in and re-evaluates badges. If `targetUserId` is provided, the caller
// must be the advisor for that club (or an admin); used by the manual-mark UI.
// Otherwise XP is awarded to the calling user.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as
    | { clubId?: string; durationMinutes?: number; targetUserId?: string }
    | null
  if (!body?.clubId) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 })
  }

  const db = createServiceClient()
  const [{ data: clubRow }, { data: userRow }] = await Promise.all([
    db.from('clubs').select('school_id, advisor_id').eq('id', body.clubId).maybeSingle(),
    db.from('users').select('school_id, role').eq('id', userId).maybeSingle(),
  ])
  if (!clubRow?.school_id || clubRow.school_id !== userRow?.school_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let awardUserId = userId
  if (body.targetUserId && body.targetUserId !== userId) {
    const isClubManager =
      userRow?.role === 'admin' ||
      userRow?.role === 'superadmin' ||
      clubRow.advisor_id === userId
    if (!isClubManager) {
      return NextResponse.json({ error: 'Only the advisor can mark others' }, { status: 403 })
    }
    // Confirm target is in the same school
    const { data: targetRow } = await db
      .from('users')
      .select('school_id')
      .eq('id', body.targetUserId)
      .maybeSingle()
    if (targetRow?.school_id !== clubRow.school_id) {
      return NextResponse.json({ error: 'Target outside school' }, { status: 403 })
    }
    awardUserId = body.targetUserId
  }

  const minutes = typeof body.durationMinutes === 'number' && body.durationMinutes > 0
    ? body.durationMinutes
    : DEFAULT_MEETING_MINUTES

  const result = await awardCheckInXp(awardUserId, minutes)
  return NextResponse.json(result)
}
