'use client'

/**
 * Offline mutation queue.
 *
 * When the browser is offline, mutations (POST/PUT/DELETE fetches) are
 * serialised to localStorage.  When connectivity is restored the queue
 * is replayed in FIFO order.
 */

interface QueuedMutation {
  id: string
  url: string
  init: RequestInit
  createdAt: number
}

const STORAGE_KEY = 'clubit_offline_queue'

function readQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedMutation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // storage full — drop silently
  }
}

const MAX_QUEUE_SIZE = 50
const MAX_ENTRY_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Enqueue a mutation to be replayed when online. */
export function enqueueMutation(url: string, init: RequestInit) {
  let queue = readQueue()

  // Evict stale entries (older than 24h — they'd be nonsensical to replay)
  const now = Date.now()
  queue = queue.filter((e) => now - e.createdAt < MAX_ENTRY_AGE_MS)

  // Cap queue size to prevent localStorage exhaustion
  if (queue.length >= MAX_QUEUE_SIZE) {
    console.warn('Offline queue full — dropping oldest entry')
    queue.shift()
  }

  // Strip authorization headers — tokens will be stale by replay time anyway,
  // and storing them in localStorage is a security risk. Keep Content-Type only.
  const safeHeaders: Record<string, string> = {}
  if (init.headers) {
    const h = init.headers as Record<string, string>
    if (h['Content-Type'] || h['content-type']) {
      safeHeaders['Content-Type'] = h['Content-Type'] || h['content-type']
    }
  }

  queue.push({
    id: `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    init: {
      method: init.method,
      headers: safeHeaders,
      body: typeof init.body === 'string' ? init.body : undefined,
    },
    createdAt: Date.now(),
  })
  writeQueue(queue)
}

const LOCK_KEY = 'clubit_offline_queue_lock'
const LOCK_TTL_MS = 30_000 // 30s — prevents stale locks from blocking forever

let localFlushing = false

function acquireLock(): boolean {
  if (localFlushing) return false
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    if (raw) {
      const ts = Number(raw)
      // If the lock is older than the TTL, treat it as stale (tab crashed, etc.)
      if (Date.now() - ts < LOCK_TTL_MS) return false
    }
    localStorage.setItem(LOCK_KEY, String(Date.now()))
    localFlushing = true
    return true
  } catch {
    return false
  }
}

function releaseLock() {
  localFlushing = false
  try { localStorage.removeItem(LOCK_KEY) } catch { /* ignore */ }
}

/** Replay all queued mutations, removing each on success. */
export async function flushQueue() {
  if (!acquireLock()) return

  try {
    const now = Date.now()
    // Evict stale entries before replaying
    const queue = readQueue().filter((e) => now - e.createdAt < MAX_ENTRY_AGE_MS)
    if (queue.length === 0) {
      writeQueue([])
      return
    }

    const remaining: QueuedMutation[] = []

    for (const entry of queue) {
      try {
        const res = await fetch(entry.url, entry.init)
        if (!res.ok && res.status >= 500) {
          // Server error — keep in queue to retry later
          remaining.push(entry)
        }
        // 4xx errors are dropped (stale / invalid)
      } catch {
        // Still offline or network error — keep
        remaining.push(entry)
        break // stop replaying, still offline
      }
    }

    writeQueue(remaining)
  } finally {
    releaseLock()
  }
}

/** Number of pending mutations. */
export function queueSize(): number {
  return readQueue().length
}

/**
 * Wrapper around fetch that queues mutations when offline.
 * GET requests are never queued.
 *
 * TODO: Not yet integrated — callers (e.g. chat-store sendMessage) still use
 * raw fetch.  To adopt this, callers must handle the synthetic 202 response
 * (no server-assigned ID) and reconcile once the queue flushes.
 */
export function offlineAwareFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()

  if (method === 'GET' || navigator.onLine) {
    return fetch(url, init)
  }

  // Offline mutation — queue it and return a synthetic 202
  enqueueMutation(url, init ?? {})
  return Promise.resolve(
    new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}
