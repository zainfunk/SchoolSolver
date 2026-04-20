// Server-only badge / XP evaluation. Uses the Supabase service role client
// because writes to user_badges and users.xp_total bypass RLS by design.
import 'server-only'
import { createServiceClient } from '@/lib/supabase'
import { BADGES, BadgeContext } from './badges'
import { XP } from './xp'
import { computeStreak } from './streaks'
import { DEFAULT_MEETING_MINUTES } from './hours'

export interface EvaluateResult {
  newlyAwarded: string[]
  xpAwarded: number
  newXpTotal: number
}

// Recompute every badge for a user, insert any newly-earned ones, and bump
// users.xp_total by the corresponding XP. Idempotent: existing badges are left alone.
export async function evaluateAndAwardBadges(userId: string): Promise<EvaluateResult> {
  const db = createServiceClient()

  const [
    membershipsRes,
    leadershipRes,
    attendanceRes,
    earnedRes,
    userRes,
    eventCreatorRes,
  ] = await Promise.all([
    db.from('memberships')
      .select('club_id, hours_adjustment_minutes')
      .eq('user_id', userId),
    db.from('leadership_positions')
      .select('id')
      .eq('user_id', userId),
    db.from('attendance_records')
      .select('id, club_id, meeting_date, present, duration_minutes')
      .eq('user_id', userId),
    db.from('user_badges')
      .select('badge_key')
      .eq('user_id', userId),
    db.from('users')
      .select('xp_total')
      .eq('id', userId)
      .maybeSingle(),
    db.from('clubs')
      .select('id')
      .contains('event_creator_ids', [userId]),
  ])

  const memberships = membershipsRes.data ?? []
  const leadership = leadershipRes.data ?? []
  const attendance = attendanceRes.data ?? []
  const earnedKeys = new Set((earnedRes.data ?? []).map((r) => r.badge_key as string))
  const currentXp = (userRes.data?.xp_total as number | null) ?? 0
  const hasEventCreator = (eventCreatorRes.data ?? []).length > 0

  const totalMeetings = attendance.length
  const presentRecords = attendance.filter((r) => r.present)
  const presentCount = presentRecords.length
  const attendancePct = totalMeetings > 0 ? presentCount / totalMeetings : 0
  const autoMinutes = presentRecords.reduce(
    (sum, r) => sum + ((r.duration_minutes as number | null) ?? DEFAULT_MEETING_MINUTES),
    0,
  )
  const adjustmentMinutes = memberships.reduce(
    (sum, m) => sum + ((m.hours_adjustment_minutes as number | null) ?? 0),
    0,
  )
  const totalHoursMinutes = Math.max(0, autoMinutes + adjustmentMinutes)

  const streak = computeStreak(
    attendance.map((r) => ({
      id: r.id as string,
      clubId: r.club_id as string,
      userId,
      meetingDate: r.meeting_date as string,
      present: r.present as boolean,
    })),
  )

  const ctx: BadgeContext = {
    clubCount: memberships.length,
    leadershipCount: leadership.length,
    totalMeetings,
    presentCount,
    attendancePct,
    totalHoursMinutes,
    longestStreak: streak.longest,
    hasEventCreator,
  }

  const toInsert: { user_id: string; badge_key: string; club_id: null }[] = []
  let xpDelta = 0

  for (const def of BADGES) {
    if (earnedKeys.has(def.key)) continue
    if (!def.evaluate(ctx)) continue
    toInsert.push({ user_id: userId, badge_key: def.key, club_id: null })
    xpDelta += def.xp
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await db
      .from('user_badges')
      .upsert(toInsert, { onConflict: 'user_id,badge_key,club_id', ignoreDuplicates: true })
    if (insertErr) console.error('user_badges insert', insertErr)
  }

  let newXpTotal = currentXp
  if (xpDelta > 0) {
    newXpTotal = currentXp + xpDelta
    const { error: updErr } = await db
      .from('users')
      .update({ xp_total: newXpTotal })
      .eq('id', userId)
    if (updErr) console.error('users xp update', updErr)
  }

  return {
    newlyAwarded: toInsert.map((b) => b.badge_key),
    xpAwarded: xpDelta,
    newXpTotal,
  }
}

// Add raw XP (used by check-in awards). Returns the new total.
export async function awardXp(userId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0
  const db = createServiceClient()
  const { data: row } = await db
    .from('users')
    .select('xp_total')
    .eq('id', userId)
    .maybeSingle()
  const current = (row?.xp_total as number | null) ?? 0
  const next = current + amount
  await db.from('users').update({ xp_total: next }).eq('id', userId)
  return next
}

// Convenience for the check-in path: award the per-check-in XP, then re-evaluate badges.
export async function awardCheckInXp(userId: string, durationMinutes: number): Promise<EvaluateResult> {
  const hours = Math.max(1, Math.round(durationMinutes / 60))
  await awardXp(userId, XP.CHECK_IN + XP.PER_HOUR * hours)
  return evaluateAndAwardBadges(userId)
}
