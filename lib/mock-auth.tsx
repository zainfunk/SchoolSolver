'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { User } from '@/types'
import { USERS } from '@/lib/mock-data'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  realUser: User | null        // the actual Clerk-backed Supabase user
  currentUser: User            // what's being viewed as (real or mock for testing)
  setCurrentUser: (user: User) => void
  isViewingAs: boolean         // true when viewing as a mock user
  resetToSelf: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const FALLBACK_USER = USERS.find((u) => u.role === 'student')!

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser()
  const [realUser, setRealUser] = useState<User | null>(null)
  const [viewAsUser, setViewAsUser] = useState<User | null>(null)

  useEffect(() => {
    if (!isLoaded || !clerkUser) return

    const supabaseUser: User = {
      id: clerkUser.id,
      name: clerkUser.fullName ?? clerkUser.username ?? 'New User',
      email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
      role: 'student',
      avatarUrl: clerkUser.imageUrl,
    }

    // Upsert into users table so FK constraints work
    supabase.from('users').upsert(supabaseUser, { onConflict: 'id' }).then(({ error }) => {
      if (error) console.error('Failed to upsert user:', error)
    })

    // Check if they already have a saved role in Supabase
    supabase.from('users').select('role').eq('id', clerkUser.id).maybeSingle().then(({ data }) => {
      const role = (data?.role as User['role']) ?? 'student'
      const userWithRole: User = { ...supabaseUser, role }
      setRealUser(userWithRole)
    })
  }, [isLoaded, clerkUser?.id])

  const currentUser = viewAsUser ?? realUser ?? FALLBACK_USER

  return (
    <AuthContext.Provider value={{
      realUser,
      currentUser,
      setCurrentUser: setViewAsUser,
      isViewingAs: viewAsUser !== null,
      resetToSelf: () => setViewAsUser(null),
      logout: () => setViewAsUser(null),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useMockAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useMockAuth must be used inside MockAuthProvider')
  return ctx
}
