import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAuthedServerClient } from '@/lib/supabase'
import { profileLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// GET — fetch profile for current user or ?userId=... (RLS limits to same school).
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const targetId = request.nextUrl.searchParams.get('userId') || userId

  // W2.4: authed client; RLS on user_profiles uses app.user_in_scope which
  // already gates same-school access. The previous TS-level check was
  // duplicating that, so it's removed.
  const db = await createAuthedServerClient()

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

// PATCH — update profile for current user (admins can edit others via ?userId=...; RLS enforces).
export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await profileLimiter.check(`user:${userId}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many profile updates', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const targetId = request.nextUrl.searchParams.get('userId') || userId
  const body = await request.json() as Record<string, unknown>

  const db = await createAuthedServerClient()

  // Fetch current profile to merge. RLS may return null if the caller
  // can't read it; that's fine -- the upsert below will then fail RLS
  // too and we return 403.
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
    // 42501 = insufficient_privilege => RLS denied; surface as 403.
    if ((error as { code?: string }).code === '42501') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
