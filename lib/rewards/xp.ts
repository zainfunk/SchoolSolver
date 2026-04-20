// XP awards (server-side, applied when events occur)
export const XP = {
  CHECK_IN: 5,
  PER_HOUR: 10,         // applied alongside CHECK_IN, scaled by minutes/60
  BADGE_DEFAULT: 50,    // overridable per-badge
  LEADERSHIP: 100,      // one-shot when first holding a position
  CLUB_JOIN: 20,
} as const

// Quadratic level curve: each level requires 50 more XP than the last.
// Level n requires n^2 * 50 total XP.
//   L1 = 50, L2 = 200, L3 = 450, L5 = 1250, L10 = 5000, L20 = 20_000
export function xpToLevel(xp: number): number {
  if (xp <= 0) return 0
  return Math.floor(Math.sqrt(xp / 50))
}

export function xpForLevel(level: number): number {
  return level * level * 50
}

export interface LevelProgress {
  level: number
  xp: number
  currentLevelXp: number
  nextLevelXp: number
  progressPct: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = xpToLevel(xp)
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const span = Math.max(1, nextLevelXp - currentLevelXp)
  const progressPct = Math.max(0, Math.min(1, (xp - currentLevelXp) / span))
  return { level, xp, currentLevelXp, nextLevelXp, progressPct }
}

// Friendly title per level band
export function levelTitle(level: number): string {
  if (level >= 20) return 'Legend'
  if (level >= 15) return 'Champion'
  if (level >= 10) return 'Veteran'
  if (level >= 7) return 'Mentor'
  if (level >= 5) return 'Active Member'
  if (level >= 3) return 'Contributor'
  if (level >= 1) return 'Member'
  return 'Newcomer'
}
