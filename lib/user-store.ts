/**
 * Persists profile overrides in localStorage.
 * - Any user can update their own email.
 * - Only admins can update a user's name.
 */

const KEY = 'ss_user_overrides'

type Override = { name?: string; email?: string }
type OverrideMap = Record<string, Override>

function load(): OverrideMap {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function save(map: OverrideMap) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function getOverride(userId: string): Override {
  return load()[userId] ?? {}
}

export function setName(userId: string, name: string) {
  const map = load()
  map[userId] = { ...map[userId], name: name.trim() }
  save(map)
}

export function setEmail(userId: string, email: string) {
  const map = load()
  map[userId] = { ...map[userId], email: email.trim() }
  save(map)
}

/** Merge base user data with any stored overrides. */
export function applyOverrides<T extends { id: string; name: string; email: string }>(user: T): T {
  const ov = getOverride(user.id)
  return { ...user, ...(ov.name ? { name: ov.name } : {}), ...(ov.email ? { email: ov.email } : {}) }
}
