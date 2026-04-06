export type Role = 'admin' | 'advisor' | 'student'

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected'

export interface JoinRequest {
  id: string
  clubId: string
  userId: string
  requestedAt: string // ISO timestamp — used for FCFS sorting
  status: JoinRequestStatus
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl?: string
}

export interface LeadershipPosition {
  id: string
  title: string
  userId?: string
}

export interface SocialLink {
  platform: 'instagram' | 'twitter' | 'discord' | 'facebook' | 'website' | 'other'
  url: string
}

export interface MeetingTime {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string
  endTime: string
  location?: string
}

export interface Club {
  id: string
  name: string
  description: string
  iconUrl?: string
  capacity: number | null // null = unlimited
  advisorId: string
  memberIds: string[]
  leadershipPositions: LeadershipPosition[]
  socialLinks: SocialLink[]
  meetingTimes: MeetingTime[]
  tags?: string[]
  createdAt: string
  autoAccept: boolean // auto-approve requests until capacity; after limit requires manual approval
}

export interface Membership {
  id: string
  clubId: string
  userId: string
  joinedAt: string
}

export interface ClubEvent {
  id: string
  clubId: string
  title: string
  description: string
  date: string
  location?: string
  isPublic: boolean
}

export interface AttendanceRecord {
  id: string
  clubId: string
  userId: string
  meetingDate: string
  present: boolean
}

// --- Polls & Elections ---

export interface PollCandidate {
  userId: string
  votes: string[] // userIds who voted for this candidate
}

/** Club-level poll pushed by an advisor — only club members can vote */
export interface Poll {
  id: string
  clubId: string
  positionTitle: string
  candidates: PollCandidate[]
  createdAt: string
  isOpen: boolean
}

/** School-wide election pushed by an admin — all users can vote */
export interface SchoolElection {
  id: string
  positionTitle: string
  description: string
  candidates: PollCandidate[]
  createdAt: string
  isOpen: boolean
}
