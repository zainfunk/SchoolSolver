import { AttendanceSession, AttendanceRecord } from '@/types'

const SESSIONS_KEY = 'ss_att_sessions'
const RECORDS_KEY  = 'ss_att_records'

function safe<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}

function persist(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

// --- Sessions ---

export function getAllSessions(): AttendanceSession[] {
  return safe<AttendanceSession[]>(SESSIONS_KEY, [])
}

export function getSessionsByClub(clubId: string): AttendanceSession[] {
  return getAllSessions().filter((s) => s.clubId === clubId)
}

export function getSessionById(id: string): AttendanceSession | undefined {
  return getAllSessions().find((s) => s.id === id)
}

export function saveSession(session: AttendanceSession) {
  const all = getAllSessions()
  const idx = all.findIndex((s) => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.push(session)
  persist(SESSIONS_KEY, all)
}

export function markSessionCheckin(sessionId: string, userId: string) {
  const session = getSessionById(sessionId)
  if (!session) return
  if (!session.recordedUserIds.includes(userId)) {
    session.recordedUserIds.push(userId)
    saveSession(session)
  }
}

// --- Extra attendance records (QR check-ins + manual edits) ---

export function getStoredRecords(): AttendanceRecord[] {
  return safe<AttendanceRecord[]>(RECORDS_KEY, [])
}

export function getRecordsByClub(clubId: string): AttendanceRecord[] {
  return getStoredRecords().filter((r) => r.clubId === clubId)
}

/** Upsert: if a record for club+user+date exists, update it; otherwise insert. */
export function upsertRecord(
  clubId: string, userId: string, meetingDate: string, present: boolean
): string {
  const all = getStoredRecords()
  const existing = all.find(
    (r) => r.clubId === clubId && r.userId === userId && r.meetingDate === meetingDate
  )
  const id = existing?.id ?? `att-dyn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const record: AttendanceRecord = { id, clubId, userId, meetingDate, present }
  const idx = all.findIndex((r) => r.id === id)
  if (idx >= 0) all[idx] = record
  else all.push(record)
  persist(RECORDS_KEY, all)
  return id
}

// Haversine distance in metres between two GPS coordinates
export function haversineMeters(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
