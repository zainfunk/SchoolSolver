import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET — fetch name/email overrides for current user or ?userId=...
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const targetId = request.nextUrl.searchParams.get('userId') || userId

  const db = createServiceClient()
  const { data } = await db
    .from('user_overrides')
    .select('name, email')
    .eq('user_id', targetId)
    .maybeSingle()

  return NextResponse.json(data ?? {})
}

// PATCH — update name/email overrides (own profile, or admin editing another user via ?userId=...)
export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const targetId = request.nextUrl.searchParams.get('userId') || userId
  const body = await request.json() as Record<string, unknown>

  // If editing someone else, must be admin
  if (targetId !== userId) {
    const db = createServiceClient()
    const { data: me } = await db.from('users').select('role').eq('id', userId).maybeSingle()
    if (me?.role !== 'admin' && me?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only admins can edit other users' }, { status: 403 })
    }
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.email === 'string' && body.email.trim()) patch.email = body.email.trim()

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('user_overrides')
    .upsert(
      { user_id: targetId, ...patch },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('user overrides update error', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
