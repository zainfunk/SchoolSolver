'use client'

import { useState } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { SCHOOL_ELECTIONS, USERS } from '@/lib/mock-data'
import { SchoolElection } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Vote } from 'lucide-react'

export default function ElectionsPage() {
  const { currentUser } = useMockAuth()
  const [elections, setElections] = useState<SchoolElection[]>(SCHOOL_ELECTIONS)

  function castVote(electionId: string, candidateUserId: string) {
    setElections((prev) =>
      prev.map((e) =>
        e.id === electionId
          ? {
              ...e,
              candidates: e.candidates.map((c) =>
                c.userId === candidateUserId
                  ? { ...c, votes: [...c.votes, currentUser.id] }
                  : c
              ),
            }
          : e
      )
    )
  }

  function getUserById(id: string) {
    return USERS.find((u) => u.id === id)
  }

  const openElections = elections.filter((e) => e.isOpen)
  const closedElections = elections.filter((e) => !e.isOpen)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Vote className="w-6 h-6 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">School Elections</h1>
            <p className="text-sm text-gray-500 mt-0.5">School-wide elections open to all students and staff.</p>
          </div>
        </div>
      </div>

      {openElections.length === 0 && closedElections.length === 0 && (
        <div className="text-center py-20 bg-white rounded-xl border">
          <Vote className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No elections are currently running.</p>
          <p className="text-sm text-gray-400 mt-1">Check back later or contact your school admin.</p>
        </div>
      )}

      {openElections.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Open Elections</h2>
          <div className="space-y-4">
            {openElections.map((election) => {
              const totalVotes = election.candidates.reduce((s, c) => s + c.votes.length, 0)
              const alreadyVoted = election.candidates.some((c) =>
                c.votes.includes(currentUser.id)
              )

              return (
                <Card key={election.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{election.positionTitle}</CardTitle>
                        {election.description && (
                          <p className="text-sm text-gray-500 mt-1">{election.description}</p>
                        )}
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">
                        Open
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {election.candidates.map((candidate) => {
                        const user = getUserById(candidate.userId)
                        const pct = totalVotes > 0
                          ? Math.round((candidate.votes.length / totalVotes) * 100)
                          : 0
                        const hasVotedThis = candidate.votes.includes(currentUser.id)

                        return (
                          <div key={candidate.userId} className="flex items-center gap-3">
                            {!alreadyVoted ? (
                              <button
                                onClick={() => castVote(election.id, candidate.userId)}
                                className="w-5 h-5 rounded-full border-2 border-purple-400 flex items-center justify-center shrink-0 hover:bg-purple-50 transition-colors"
                                title={`Vote for ${user?.name}`}
                              />
                            ) : (
                              <span
                                className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-xs ${
                                  hasVotedThis
                                    ? 'bg-purple-500 text-white'
                                    : 'border border-gray-300'
                                }`}
                              >
                                {hasVotedThis ? '✓' : ''}
                              </span>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-800">{user?.name}</span>
                                <span className="text-xs text-gray-400">
                                  {alreadyVoted || totalVotes > 0
                                    ? `${candidate.votes.length} vote${candidate.votes.length !== 1 ? 's' : ''}`
                                    : ''}
                                  {alreadyVoted && totalVotes > 0 ? ` (${pct}%)` : ''}
                                </span>
                              </div>
                              {alreadyVoted && (
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-purple-400 h-2 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {alreadyVoted ? (
                      <p className="text-xs text-gray-400 mt-3">
                        You have voted. Results will be shown when the election closes.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-3">
                        Select a candidate to cast your vote. You can only vote once.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {closedElections.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Past Elections</h2>
          <div className="space-y-4">
            {closedElections.map((election) => {
              const totalVotes = election.candidates.reduce((s, c) => s + c.votes.length, 0)
              const winner = election.candidates.reduce((a, b) =>
                a.votes.length >= b.votes.length ? a : b
              )

              return (
                <Card key={election.id} className="opacity-75">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{election.positionTitle}</CardTitle>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                        Closed
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mb-3">
                      Winner: {getUserById(winner.userId)?.name} ({winner.votes.length} votes)
                    </p>
                    <div className="space-y-2">
                      {election.candidates.map((c) => {
                        const user = getUserById(c.userId)
                        const pct = totalVotes > 0 ? Math.round((c.votes.length / totalVotes) * 100) : 0
                        return (
                          <div key={c.userId} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-28 shrink-0">{user?.name}</span>
                            <div className="flex-1">
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className="bg-purple-300 h-2 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                              {c.votes.length} ({pct}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
