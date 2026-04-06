/**
 * Persists club form responses in localStorage.
 * Map shape: { [formId]: userId[] }
 */

const KEY = 'ss_form_responses'

type ResponseMap = Record<string, string[]>

function load(): ResponseMap {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function persist(map: ResponseMap) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function hasResponded(formId: string, userId: string): boolean {
  return (load()[formId] ?? []).includes(userId)
}

export function addResponse(formId: string, userId: string): void {
  const map = load()
  if (!map[formId]) map[formId] = []
  if (!map[formId].includes(userId)) map[formId].push(userId)
  persist(map)
}

export function getResponseCount(formId: string): number {
  return (load()[formId] ?? []).length
}
