import { supabase } from '@/lib/supabase'

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

export async function getProfile(userId: string): Promise<UserProfileData> {
  try {
    const res = await fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return { ...DEFAULT_PROFILE }
    return await res.json() as UserProfileData
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export async function setProfile(userId: string, partial: Partial<UserProfileData>): Promise<void> {
  await fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  })
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
