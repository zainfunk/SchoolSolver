/**
 * Persists extended profile data (bio, skills, interests, socials) in localStorage.
 */

const KEY = 'ss_user_profiles'

export interface PersonalSocialLink {
  id: string
  label: string
  url: string
}

export interface UserProfileData {
  bio: string
  skills: string[]
  interests: string[]
  socials: PersonalSocialLink[]
}

const DEFAULT_PROFILE: UserProfileData = {
  bio: '',
  skills: [],
  interests: [],
  socials: [],
}

function load(): Record<string, UserProfileData> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function persist(map: Record<string, UserProfileData>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function getProfile(userId: string): UserProfileData {
  return { ...DEFAULT_PROFILE, ...load()[userId] }
}

export function setProfile(userId: string, data: Partial<UserProfileData>) {
  const map = load()
  map[userId] = { ...DEFAULT_PROFILE, ...map[userId], ...data }
  persist(map)
}

// ---- Preset options ----

export const PRESET_SKILLS = [
  'Programming', 'Web Development', 'Graphic Design', 'Video Editing',
  'Public Speaking', 'Leadership', 'Photography', 'Writing', 'Music',
  'Drawing', 'Math', 'Science', 'Research', 'Debate', 'Acting',
  'Dance', 'Robotics', '3D Modeling', 'Data Analysis', 'Sports',
]

export const PRESET_INTERESTS = [
  'Technology', 'Arts & Crafts', 'Music', 'Sports', 'Environment',
  'Literature', 'Science', 'History', 'Politics', 'Gaming',
  'Film', 'Photography', 'Travel', 'Cooking', 'Fashion',
  'Volunteering', 'Entrepreneurship', 'Mental Health', 'Space', 'Anime',
]

export const SOCIAL_PLATFORMS = [
  'Instagram', 'Twitter / X', 'LinkedIn', 'GitHub',
  'YouTube', 'TikTok', 'Discord', 'Website', 'Other',
]
