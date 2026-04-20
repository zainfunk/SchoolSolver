// Badge catalog. Definitions live in code; the DB only stores unlock events
// in `user_badges`. To add a badge: add an entry here and rerun evaluateAndAwardBadges.

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface BadgeContext {
  clubCount: number
  leadershipCount: number
  totalMeetings: number
  presentCount: number
  attendancePct: number       // 0..1
  totalHoursMinutes: number
  longestStreak: number
  hasEventCreator: boolean
}

export interface BadgeDef {
  key: string
  title: string
  desc: string
  tier: BadgeTier
  icon: string                // lucide icon name (referenced from BadgeGrid)
  xp: number
  evaluate: (ctx: BadgeContext) => boolean
}

const TIER_XP: Record<BadgeTier, number> = {
  bronze: 25,
  silver: 75,
  gold: 200,
  platinum: 500,
}

function badge(
  key: string,
  title: string,
  desc: string,
  tier: BadgeTier,
  icon: string,
  evaluate: (ctx: BadgeContext) => boolean,
  xpOverride?: number,
): BadgeDef {
  return { key, title, desc, tier, icon, xp: xpOverride ?? TIER_XP[tier], evaluate }
}

export const BADGES: BadgeDef[] = [
  // — Club membership tier —
  badge('club_member', 'Club Member', 'Joined your first club', 'bronze', 'BookOpen',
    (c) => c.clubCount >= 1),
  badge('multitasker', 'Multitasker', 'Active in 2+ clubs', 'silver', 'Users',
    (c) => c.clubCount >= 2),
  badge('club_collector', 'Club Collector', 'Active in 4+ clubs', 'gold', 'Layers',
    (c) => c.clubCount >= 4),

  // — Leadership tier —
  badge('leader', 'Leader', 'Hold a leadership position', 'silver', 'Star',
    (c) => c.leadershipCount >= 1),
  badge('multi_leader', 'Multi-Leader', 'Lead 2+ clubs at once', 'gold', 'Crown',
    (c) => c.leadershipCount >= 2),
  badge('event_creator', 'Event Creator', 'Granted event/news creation rights', 'silver', 'Megaphone',
    (c) => c.hasEventCreator),

  // — Attendance % tier —
  badge('committed', 'Committed', 'Attended 80%+ of meetings', 'silver', 'Flame',
    (c) => c.totalMeetings >= 5 && c.attendancePct >= 0.8),
  badge('perfect_attendance', 'Perfect Attendance', 'Never missed a meeting (5+ logged)', 'gold', 'Trophy',
    (c) => c.totalMeetings >= 5 && c.presentCount === c.totalMeetings),

  // — Meeting count tier —
  badge('regular', 'Regular', 'Attended 5 meetings', 'bronze', 'Check',
    (c) => c.presentCount >= 5),
  badge('high_participation', 'High Participation', 'Attended 10 meetings', 'silver', 'Zap',
    (c) => c.presentCount >= 10),
  badge('dedicated', 'Dedicated', 'Attended 25 meetings', 'gold', 'Award',
    (c) => c.presentCount >= 25),
  badge('iron_will', 'Iron Will', 'Attended 50 meetings', 'platinum', 'ShieldCheck',
    (c) => c.presentCount >= 50),

  // — Hours tier —
  badge('hours_10', '10 Hours', 'Logged 10 hours of club time', 'bronze', 'Clock',
    (c) => c.totalHoursMinutes >= 10 * 60),
  badge('hours_25', '25 Hours', 'Logged 25 hours of club time', 'silver', 'Clock4',
    (c) => c.totalHoursMinutes >= 25 * 60),
  badge('hours_50', '50 Hours', 'Logged 50 hours of club time', 'gold', 'Clock9',
    (c) => c.totalHoursMinutes >= 50 * 60),
  badge('hours_100', 'Centurion', 'Logged 100 hours of club time', 'platinum', 'Hourglass',
    (c) => c.totalHoursMinutes >= 100 * 60),

  // — Streak tier (consecutive meetings attended in any club) —
  badge('streak_3', 'On a Roll', '3-meeting attendance streak', 'bronze', 'Flame',
    (c) => c.longestStreak >= 3),
  badge('streak_5', 'Hot Streak', '5-meeting attendance streak', 'silver', 'Flame',
    (c) => c.longestStreak >= 5),
  badge('streak_10', 'Unstoppable', '10-meeting attendance streak', 'gold', 'Sparkles',
    (c) => c.longestStreak >= 10),
  badge('streak_20', 'Legendary Streak', '20-meeting attendance streak', 'platinum', 'Rocket',
    (c) => c.longestStreak >= 20),
]

export function findBadge(key: string): BadgeDef | undefined {
  return BADGES.find((b) => b.key === key)
}

export const TIER_STYLES: Record<BadgeTier, { bg: string; text: string; ring: string; label: string }> = {
  bronze:   { bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200',  label: 'Bronze' },
  silver:   { bg: 'bg-slate-50',  text: 'text-slate-700',  ring: 'ring-slate-200',  label: 'Silver' },
  gold:     { bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-200', label: 'Gold' },
  platinum: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200', label: 'Platinum' },
}
