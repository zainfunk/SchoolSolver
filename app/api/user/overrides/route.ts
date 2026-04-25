import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAuthedServerClient } from '@/lib/supabase'
import { profileLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// GET — fetch name/email overrides for current user or ?userId=...
// (RLS gates same-school visibility via app.user_in_scope).
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const targetId = request.nextUrl.searchParams.get('userId') || userId

  // W2.4: authed client; RLS on user_overrides_select limits to same-school.
  const db = await createAuthedServerClient()
  const { data } = await db
    .from('user_overrides')
    .select('name, email')
    .eq('user_id', targetId)
    .maybeSingle()

  return NextResponse.json(data ?? {})
}

// PATCH — update name/email overrides (own profile, or admin editing another via ?userId=...;
// RLS enforces both).
export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await profileLimiter.check(`user:${userId}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many edits', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const targetId = request.nextUrl.searchParams.get('userId') || userId
  const body = await request.json() as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.email === 'string' && body.email.trim()) patch.email = body.email.trim()

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = await createAuthedServerClient()
  const { error } = await db
    .from('user_overrides')
    .upsert(
      { user_id: targetId, ...patch },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('user overrides update error', error)
    if ((error as { code?: string }).code === '42501') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
