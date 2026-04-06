'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { ChatMessage } from '@/types'
import { CHAT_MESSAGES } from '@/lib/mock-data'

interface ChatContextValue {
  messages: ChatMessage[]
  sendMessage: (clubId: string, senderId: string, content: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(CHAT_MESSAGES)

  function sendMessage(clubId: string, senderId: string, content: string) {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      clubId,
      senderId,
      content: content.trim(),
      sentAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, msg])
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
