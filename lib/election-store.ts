/**
 * Persists election & poll votes in localStorage so they survive navigation.
 * Map shape: { [electionId]: { [candidateUserId]: voterUserIds[] } }
 */

const KEY = 'ss_election_votes'

type VoteMap = Record<string, Record<string, string[]>>

function load(): VoteMap {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function persist(map: VoteMap) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function getVotes(electionId: string): Record<string, string[]> {
  return load()[electionId] ?? {}
}

export function hasVoted(electionId: string, voterId: string): boolean {
  const votes = load()[electionId] ?? {}
  return Object.values(votes).some((voters) => voters.includes(voterId))
}

export function castVote(electionId: string, candidateUserId: string, voterId: string): void {
  if (hasVoted(electionId, voterId)) return
  const map = load()
  if (!map[electionId]) map[electionId] = {}
  if (!map[electionId][candidateUserId]) map[electionId][candidateUserId] = []
  map[electionId][candidateUserId].push(voterId)
  persist(map)
}
