'use client'

import { type ReactNode } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { useRealtimeSync } from '@/lib/realtime'

/**
 * Thin wrapper that calls useRealtimeSync once at the app level.
 * Must be rendered inside MockAuthProvider (needs currentUser).
 */
export default function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useMockAuth()
  useRealtimeSync(currentUser.schoolId, currentUser.id || undefined)
  return <>{children}</>
}
