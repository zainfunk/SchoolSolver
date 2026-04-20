import { AttendanceRecord } from '@/types'

export interface StreakInfo {
  current: number
  longest: number
}

// Compute streak from attendance records ordered by meeting_date.
// A streak counts consecutive logged meetings the user attended (present=true).
// A logged meeting where the user was absent breaks the streak.
// Records are not deduped — each (clubId, meetingDate) pair contributes once.
export function computeStreak(records: AttendanceRecord[]): StreakInfo {
  if (records.length === 0) return { current: 0, longest: 0 }

  const sorted = [...records].sort((a, b) =>
    a.meetingDate < b.meetingDate ? -1 : a.meetingDate > b.meetingDate ? 1 : 0,
  )

  let longest = 0
  let run = 0
  let currentRun = 0

  for (const r of sorted) {
    if (r.present) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  // Walk from the end forward to determine the live "current" streak
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].present) currentRun += 1
    else break
  }

  return { current: currentRun, longest }
}

// Per-club streak: filter records to that club, then compute.
export function computeClubStreak(records: AttendanceRecord[], clubId: string): StreakInfo {
  return computeStreak(records.filter((r) => r.clubId === clubId))
}
