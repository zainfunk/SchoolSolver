'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ChatMessage } from '@/types'
import { supabase } from '@/lib/supabase'

interface ChatContextValue {
  messages: ChatMessage[]
  sendMessage: (clubId: string, senderId: string, content: string) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  function mergeMessages(incoming: ChatMessage[]) {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))
      for (const m of incoming) map.set(m.id, m)
      return Array.from(map.values()).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    })
  }

  function fetchAll() {
    supabase.from('chat_messages').select('*').order('sent_at').then(({ data }) => {
      if (data) mergeMessages(data.map(mapMessage))
    })
  }

  useEffect(() => {
    fetchAll()

    // Real-time subscription (requires table added to Supabase Realtime publication)
    const channel = supabase
      .channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        mergeMessages([mapMessage(payload.new as Record<string, unknown>)])
      })
      .subscribe()

    // Polling fallback — keeps messages in sync even if Realtime isn't enabled
    const interval = setInterval(fetchAll, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  async function sendMessage(clubId: string, senderId: string, content: string) {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      clubId,
      senderId,
      content: content.trim(),
      sentAt: new Date().toISOString(),
    }
    // Optimistically add to local state
    setMessages((prev) => [...prev, msg])
    // Persist to Supabase and remove optimistic message on failure
    const { error } = await supabase.from('chat_messages').insert({
      id: msg.id,
      club_id: msg.clubId,
      sender_id: msg.senderId,
      content: msg.content,
      sent_at: msg.sentAt,
    })
    if (error) {
      console.error('Failed to send message:', error)
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
    }
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatStore() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatStore must be used inside ChatProvider')
  return ctx
}

function mapMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    clubId: r.club_id as string,
    senderId: r.sender_id as string,
    content: r.content as string,
    sentAt: r.sent_at as string,
  }
}
