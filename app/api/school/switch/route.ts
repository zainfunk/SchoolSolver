import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { error } = await db
    .from('users')
    .update({ school_id: null })
    .eq('id', userId)

  if (error) {
    console.error('switch school error', error)
    return NextResponse.json({ error: 'Failed to leave school' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
