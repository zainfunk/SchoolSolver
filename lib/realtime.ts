'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { invalidateCachePrefix } from '@/lib/fetch-cache'
import { flushQueue } from '@/lib/offline-queue'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Event bus — lets the realtime layer push data into stores without importing
// React contexts directly.  Stores subscribe via `onRealtimeEvent`.
// ---------------------------------------------------------------------------

export type RealtimeEventType =
  | 'chat_message_insert'
  | 'membership_insert'
  | 'membership_delete'
  | 'join_request_change'
  | 'club_update'

export interface RealtimeEvent {
  type: RealtimeEventType
  payload: Record<string, unknown>
}

type Listener = (event: RealtimeEvent) => void

const listeners = new Set<Listener>()

export function onRealtimeEvent(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function emit(event: RealtimeEvent) {
  for (const fn of listeners) {
    try { fn(event) } catch (e) { console.error('realtime listener error', e) }
  }
}

// ---------------------------------------------------------------------------
// Hook — call once at the app level (inside providers that give schoolId)
// ---------------------------------------------------------------------------

export function useRealtimeSync(schoolId: string | undefined, userId: string | undefined) {
  useEffect(() => {
    if (!schoolId || !userId) return

    const channels: RealtimeChannel[] = []

    // 1. Chat messages — INSERT
    const chatChannel = supabase
      .channel(`rt_chat_${schoolId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          emit({ type: 'chat_message_insert', payload: payload.new as Record<string, unknown> })
        },
      )
      .subscribe((status, err) => {
        if (err) console.error('rt_chat subscribe error', err)
      })
    channels.push(chatChannel)

    // 2. Memberships — INSERT / DELETE
    // Note: memberships table has no school_id column, so we can't filter
    // server-side. RLS (club_in_scope) ensures the client only receives
    // events for clubs in the user's school.
    const membershipChannel = supabase
      .channel(`rt_memberships_${schoolId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'memberships' },
        (payload) => {
          emit({ type: 'membership_insert', payload: payload.new as Record<string, unknown> })
          invalidateCachePrefix('/api/school/clubs')
          invalidateCachePrefix('/api/school/dashboard')
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'memberships' },
        (payload) => {
          emit({ type: 'membership_delete', payload: payload.old as Record<string, unknown> })
          invalidateCachePrefix('/api/school/clubs')
          invalidateCachePrefix('/api/school/dashboard')
        },
      )
      .subscribe((status, err) => {
        if (err) console.error('rt_memberships subscribe error', err)
      })
    channels.push(membershipChannel)

    // 3. Join requests — INSERT / UPDATE
    // join_requests has no school_id; RLS gates visibility via club_in_scope.
    const joinRequestChannel = supabase
      .channel(`rt_join_requests_${schoolId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'join_requests' },
        (payload) => {
          emit({ type: 'join_request_change', payload: payload.new as Record<string, unknown> })
          invalidateCachePrefix('/api/school/dashboard')
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'join_requests' },
        (payload) => {
          emit({ type: 'join_request_change', payload: payload.new as Record<string, unknown> })
          invalidateCachePrefix('/api/school/dashboard')
          invalidateCachePrefix('/api/school/clubs')
        },
      )
      .subscribe((status, err) => {
        if (err) console.error('rt_join_requests subscribe error', err)
      })
    channels.push(joinRequestChannel)

    // 4. Clubs — UPDATE (clubs table has school_id, so filter server-side)
    const clubChannel = supabase
      .channel(`rt_clubs_${schoolId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clubs', filter: `school_id=eq.${schoolId}` },
        (payload) => {
          emit({ type: 'club_update', payload: payload.new as Record<string, unknown> })
          invalidateCachePrefix('/api/school/clubs')
          invalidateCachePrefix('/api/school/dashboard')
        },
      )
      .subscribe((status, err) => {
        if (err) console.error('rt_clubs subscribe error', err)
      })
    channels.push(clubChannel)

    // --- Offline queue: flush when coming back online ---
    function handleOnline() {
      void flushQueue()
    }
    window.addEventListener('online', handleOnline)

    // If we're already online at mount, flush any stale queue entries
    if (navigator.onLine) void flushQueue()

    return () => {
      window.removeEventListener('online', handleOnline)
      for (const ch of channels) {
        supabase.removeChannel(ch)
      }
    }
  }, [schoolId, userId])
}
