import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { evaluateAndAwardBadges } from '@/lib/rewards/evaluate'

export const dynamic = 'force-dynamic'

interface PageParams {
  params: Promise<{ id: string; userId: string }>
}

// PATCH { adjustmentMinutes } — set the per-(club, member) advisor adjustment.
// The total displayed on profiles = sum(attendance.duration_minutes) + adjustment.
// Allowed for the club's advisor and for school admins.
export async function PATCH(req: NextRequest, { params }: PageParams) {
  const { userId: callerId } = await auth()
  if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: clubId, userId: memberId } = await params

  const body = await req.json().catch(() => null) as
    | { adjustmentMinutes?: number }
    | null
  if (!body || typeof body.adjustmentMinutes !== 'number' || !Number.isFinite(body.adjustmentMinutes)) {
    return NextResponse.json({ error: 'adjustmentMinutes (number) required' }, { status: 400 })
  }

  const adjustmentMinutes = Math.max(-100_000, Math.min(100_000, Math.round(body.adjustmentMinutes)))

  const db = createServiceClient()
  const [clubRes, callerRes] = await Promise.all([
    db.from('clubs').select('school_id, advisor_id').eq('id', clubId).maybeSingle(),
    db.from('users').select('school_id, role').eq('id', callerId).maybeSingle(),
  ])
  if (!clubRes.data || !callerRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (clubRes.data.school_id !== callerRes.data.school_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const isManager =
    callerRes.data.role === 'admin' ||
    callerRes.data.role === 'superadmin' ||
    clubRes.data.advisor_id === callerId
  if (!isManager) {
    return NextResponse.json({ error: 'Only the club advisor or admin can edit hours' }, { status: 403 })
  }

  const { error } = await db
    .from('memberships')
    .update({ hours_adjustment_minutes: adjustmentMinutes })
    .eq('club_id', clubId)
    .eq('user_id', memberId)
  if (error) {
    console.error('hours update', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Re-evaluate hour-based badges for the affected member.
  void evaluateAndAwardBadges(memberId).catch((e) => console.error('badge re-eval', e))

  return NextResponse.json({ ok: true, adjustmentMinutes })
}
