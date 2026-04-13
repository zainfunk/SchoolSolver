import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET — fetch profile for current user or ?userId=... (same-school only)
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const targetId = request.nextUrl.searchParams.get('userId') || userId

  const db = createServiceClient()

  // If viewing someone else's profile, ensure same school
  if (targetId !== userId) {
    const [{ data: me }, { data: them }] = await Promise.all([
      db.from('users').select('school_id').eq('id', userId).maybeSingle(),
      db.from('users').select('school_id').eq('id', targetId).maybeSingle(),
    ])
    if (!me?.school_id || me.school_id !== them?.school_id) {
      return NextResponse.json({ error: 'Not in same school' }, { status: 403 })
    }
  }

  const { data } = await db
    .from('user_profiles')
    .select('bio, skills, interests, socials')
    .eq('user_id', targetId)
    .maybeSingle()

  return NextResponse.json({
    bio: data?.bio ?? '',
    skills: data?.skills ?? [],
    interests: data?.interests ?? [],
    socials: data?.socials ?? [],
  })
}

// PATCH — update profile for current user (or admin can edit others via ?userId=...)
export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const targetId = request.nextUrl.searchParams.get('userId') || userId
  const body = await request.json() as Record<string, unknown>

  const db = createServiceClient()

  // If editing someone else, must be admin in the same school
  if (targetId !== userId) {
    const { data: me } = await db.from('users').select('role, school_id').eq('id', userId).maybeSingle()
    if (me?.role !== 'admin' && me?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only admins can edit other profiles' }, { status: 403 })
    }
  }

  // Fetch current profile to merge
  const { data: current } = await db
    .from('user_profiles')
    .select('bio, skills, interests, socials')
    .eq('user_id', targetId)
    .maybeSingle()

  const { error } = await db.from('user_profiles').upsert(
    {
      user_id: targetId,
      bio: typeof body.bio === 'string' ? body.bio : (current?.bio ?? ''),
      skills: Array.isArray(body.skills) ? body.skills : (current?.skills ?? []),
      interests: Array.isArray(body.interests) ? body.interests : (current?.interests ?? []),
      socials: body.socials !== undefined ? body.socials : (current?.socials ?? []),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('profile update error', error)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
