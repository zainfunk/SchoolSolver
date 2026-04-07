'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { CLUBS, USERS } from '@/lib/mock-data'
import { supabase } from '@/lib/supabase'
import { User, Role } from '@/types'
import Avatar from '@/components/Avatar'
import { MessageSquare } from 'lucide-react'

export default function ChatPage() {
  const { currentUser } = useMockAuth()
  const { messages } = useChatStore()
  const [myClubIds, setMyClubIds] = useState<string[]>([])
  const [supabaseUsers, setSupabaseUsers] = useState<Record<string, User>>({})

  useEffect(() => {
    if (!currentUser.id) return
    supabase.from('memberships').select('club_id').eq('user_id', currentUser.id).then(({ data }) => {
      setMyClubIds((data ?? []).map((r) => r.club_id))
    })
  }, [currentUser.id])

  useEffect(() => {
    // Fetch user data for any message sender IDs not in mock data
    const senderIds = Array.from(new Set(messages.map((m) => m.senderId)))
    const unknownIds = senderIds.filter((uid) => !USERS.find((u) => u.id === uid))
    if (unknownIds.length === 0) return
    supabase.from('users').select('id, name, email, role').in('id', unknownIds).then(({ data }) => {
      if (data?.length) {
        setSupabaseUsers((prev) => {
          const next = { ...prev }
          for (const u of data) next[u.id] = { id: u.id, name: u.name, email: u.email, role: u.role as Role }
          return next
        })
      }
    })
  }, [messages])

  function resolveUser(userId: string): User | undefined {
    return USERS.find((u) => u.id === userId) ?? supabaseUsers[userId]
  }

  const clubs = currentUser.role === 'admin'
    ? CLUBS
    : CLUBS.filter((c) =>
        myClubIds.includes(c.id) ||
        c.memberIds.includes(currentUser.id) ||
        c.advisorId === currentUser.id
      )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2
          className="text-[2rem] font-bold tracking-tight text-gray-900"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          Club Chats
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          {currentUser.role === 'admin'
            ? 'You have access to all club chats.'
            : 'Chats for clubs you belong to.'}
        </p>
      </div>

      {clubs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">You haven't joined any clubs yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clubs.map((club) => {
            const clubMessages = messages.filter((m) => m.clubId === club.id)
            const last = clubMessages[clubMessages.length - 1]
            const lastSender = last ? resolveUser(last.senderId) : null
            const advisor = resolveUser(club.advisorId)

            return (
              <Link key={club.id} href={`/chat/${club.id}`}>
                <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-100 hover:shadow-[0_4px_16px_rgba(0,88,190,0.06)] transition-all cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-xl shrink-0">
                    {club.iconUrl ?? '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate" style={{ fontFamily: 'var(--font-manrope)' }}>
                        {club.name}
                      </p>
                      {last && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(last.sentAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {last
                        ? `${lastSender?.name ?? 'Someone'}: ${last.content}`
                        : 'No messages yet — say hello!'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {advisor && <Avatar name={advisor.name} size="sm" />}
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {club.memberIds.length + 1}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
