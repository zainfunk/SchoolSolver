import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { computeStreak } from '@/lib/rewards/streaks'
import { DEFAULT_MEETING_MINUTES } from '@/lib/rewards/hours'

export const dynamic = 'force-dynamic'

const TOP_N = 25

interface LeaderboardEntry {
  userId: string
  name: string
  totalMinutes: number
  xp: number
  longestStreak: number
}

// GET — school-scoped leaderboard with three rankings (hours, XP, streak).
// Gated by admin_settings.leaderboards_enabled.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: caller } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()
  if (!caller?.school_id) return NextResponse.json({ error: 'No school' }, { status: 403 })
  const schoolId = caller.school_id as string

  const { data: settingsRow } = await db
    .from('admin_settings')
    .select('leaderboards_enabled')
    .eq('school_id', schoolId)
    .maybeSingle()
  if (settingsRow && settingsRow.leaderboards_enabled === false) {
    return NextResponse.json({ error: 'Leaderboards disabled' }, { status: 404 })
  }

  // Fetch all students in the school
  const { data: studentRows } = await db
    .from('users')
    .select('id, name, xp_total')
    .eq('school_id', schoolId)
    .eq('role', 'student')
  const students = studentRows ?? []
  if (students.length === 0) {
    return NextResponse.json({ byHours: [], byXp: [], byStreak: [] })
  }

  const studentIds = students.map((s) => s.id as string)

  const [memRes, attRes] = await Promise.all([
    db.from('memberships')
      .select('user_id, hours_adjustment_minutes')
      .in('user_id', studentIds),
    db.from('attendance_records')
      .select('user_id, club_id, meeting_date, present, duration_minutes')
      .in('user_id', studentIds),
  ])

  const adjustmentByUser = new Map<string, number>()
  for (const m of memRes.data ?? []) {
    const cur = adjustmentByUser.get(m.user_id as string) ?? 0
    adjustmentByUser.set(m.user_id as string, cur + ((m.hours_adjustment_minutes as number | null) ?? 0))
  }

  const attendanceByUser = new Map<string, typeof attRes.data>()
  for (const r of attRes.data ?? []) {
    const arr = attendanceByUser.get(r.user_id as string) ?? []
    arr.push(r)
    attendanceByUser.set(r.user_id as string, arr)
  }

  const entries: LeaderboardEntry[] = students.map((s) => {
    const records = attendanceByUser.get(s.id as string) ?? []
    const autoMinutes = records
      .filter((r) => r.present)
      .reduce((sum, r) => sum + ((r.duration_minutes as number | null) ?? DEFAULT_MEETING_MINUTES), 0)
    const adj = adjustmentByUser.get(s.id as string) ?? 0
    const streak = computeStreak(
      records.map((r) => ({
        id: '',
        clubId: r.club_id as string,
        userId: s.id as string,
        meetingDate: r.meeting_date as string,
        present: r.present as boolean,
      })),
    )
    return {
      userId: s.id as string,
      name: s.name as string,
      totalMinutes: Math.max(0, autoMinutes + adj),
      xp: (s.xp_total as number | null) ?? 0,
      longestStreak: streak.longest,
    }
  })

  const byHours = [...entries].sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, TOP_N)
  const byXp = [...entries].sort((a, b) => b.xp - a.xp).slice(0, TOP_N)
  const byStreak = [...entries].sort((a, b) => b.longestStreak - a.longestStreak).slice(0, TOP_N)

  return NextResponse.json({ byHours, byXp, byStreak })
}
