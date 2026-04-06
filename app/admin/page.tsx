'use client'

import { useState } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS as INITIAL_CLUBS, USERS, SCHOOL_ELECTIONS as INITIAL_ELECTIONS } from '@/lib/mock-data'
import { Club, SchoolElection, PollCandidate } from '@/types'
import RoleGuard from '@/components/layout/RoleGuard'
import ClubForm from '@/components/admin/ClubForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { applyOverrides } from '@/lib/user-store'
import { getClubsByMember } from '@/lib/mock-data'
import Avatar from '@/components/Avatar'
import { Users, Shield, Vote, Plus, XCircle, GraduationCap } from 'lucide-react'

export default function AdminPage() {
  const { currentUser } = useMockAuth()
  const [clubs, setClubs] = useState<Club[]>(INITIAL_CLUBS)
  const [elections, setElections] = useState<SchoolElection[]>(INITIAL_ELECTIONS)

  // Election form state
  const [showElectionForm, setShowElectionForm] = useState(false)
  const [electionTitle, setElectionTitle] = useState('')
  const [electionDescription, setElectionDescription] = useState('')
  const [electionCandidateIds, setElectionCandidateIds] = useState<string[]>([])

  const advisors = USERS.filter((u) => u.role === 'advisor')
  const students = USERS.filter((u) => u.role === 'student')

  function handleCreateClub(
    data: Omit<Club, 'id' | 'memberIds' | 'leadershipPositions' | 'socialLinks' | 'meetingTimes' | 'createdAt'>
  ) {
    const newClub: Club = {
      ...data,
      id: `club-${Date.now()}`,
      memberIds: [],
      leadershipPositions: [],
      socialLinks: [],
      meetingTimes: [],
      createdAt: new Date().toISOString().split('T')[0],
      autoAccept: false,
    }
    setClubs((prev) => [...prev, newClub])
  }

  function toggleElectionCandidate(userId: string) {
    setElectionCandidateIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  function createElection() {
    if (!electionTitle.trim() || electionCandidateIds.length < 2) return
    const newElection: SchoolElection = {
      id: `selec-${Date.now()}`,
      positionTitle: electionTitle.trim(),
      description: electionDescription.trim(),
      candidates: electionCandidateIds.map((uid) => ({ userId: uid, votes: [] })),
      createdAt: new Date().toISOString(),
      isOpen: true,
    }
    setElections((prev) => [...prev, newElection])
    setElectionTitle('')
    setElectionDescription('')
    setElectionCandidateIds([])
    setShowElectionForm(false)
  }

  function closeElection(id: string) {
    setElections((prev) => prev.map((e) => (e.id === id ? { ...e, isOpen: false } : e)))
  }

  function getUserById(id: string) {
    return USERS.find((u) => u.id === id)
  }

  return (
    <RoleGuard allowed={['admin']}>
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage clubs, advisors, and school elections</p>
          </div>
        </div>

        {/* Clubs section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-1">
            <ClubForm advisors={advisors} onSubmit={handleCreateClub} />
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              All Clubs ({clubs.length})
            </h2>
            <div className="space-y-3">
              {clubs.map((club) => {
                const advisor = USERS.find((u) => u.id === club.advisorId)
                const spotsLeft = club.capacity !== null ? club.capacity - club.memberIds.length : null
                return (
                  <Card key={club.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{club.iconUrl ?? '📌'}</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{club.name}</p>
                            <p className="text-xs text-gray-500">
                              Advisor: {advisor?.name ?? 'Unassigned'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Users className="w-3.5 h-3.5" />
                            {club.memberIds.length}/{club.capacity === null ? '∞' : club.capacity}
                          </div>
                          {club.capacity === null ? (
                            <Badge variant="secondary" className="text-xs">Unlimited</Badge>
                          ) : spotsLeft !== null && spotsLeft <= 0 ? (
                            <Badge variant="destructive" className="text-xs">Full</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{spotsLeft} spots left</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>

        {/* Student Roster */}
        <div className="border-t pt-8 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="w-5 h-5 text-green-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Student Roster</h2>
              <p className="text-sm text-gray-500">All enrolled students — click a name to view or edit their profile.</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Clubs</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {USERS.map(applyOverrides).filter((u) => u.role === 'student').map((student) => {
                  const clubs = getClubsByMember(student.id)
                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/profile/${student.id}`} className="flex items-center gap-2 group">
                          <Avatar name={student.name} size="sm" />
                          <span className="font-medium text-gray-900 group-hover:text-blue-600 group-hover:underline">
                            {student.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{student.email}</td>
                      <td className="px-4 py-3">
                        {clubs.length === 0 ? (
                          <span className="text-gray-400 italic">No clubs</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {clubs.map((c) => (
                              <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {c.iconUrl} {c.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* School Elections section */}
        <div className="border-t pt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Vote className="w-5 h-5 text-purple-500" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">School-Wide Elections</h2>
                <p className="text-sm text-gray-500">All students and staff can vote on these positions.</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setShowElectionForm((v) => !v)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Election
            </Button>
          </div>

          {/* Election creation form */}
          {showElectionForm && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Create New School Election</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Position Title *</label>
                  <Input
                    value={electionTitle}
                    onChange={(e) => setElectionTitle(e.target.value)}
                    placeholder="e.g. Student Body President"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Description</label>
                  <textarea
                    value={electionDescription}
                    onChange={(e) => setElectionDescription(e.target.value)}
                    placeholder="Brief description of the role…"
                    rows={2}
                    className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Candidates * (select 2+)
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {students.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={electionCandidateIds.includes(s.id)}
                          onChange={() => toggleElectionCandidate(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={createElection}
                    disabled={!electionTitle.trim() || electionCandidateIds.length < 2}
                  >
                    Launch Election
                  </Button>
                  <Button variant="outline" onClick={() => setShowElectionForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Election list */}
          {elections.length === 0 ? (
            <p className="text-sm text-gray-400">No school elections yet.</p>
          ) : (
            <div className="space-y-4">
              {elections.map((election) => {
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes.length, 0)
                const winner = !election.isOpen
                  ? election.candidates.reduce((a, b) => (a.votes.length >= b.votes.length ? a : b))
                  : null

                return (
                  <Card key={election.id}>
                    <CardContent className="py-4 px-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{election.positionTitle}</p>
                          {election.description && (
                            <p className="text-sm text-gray-500 mt-0.5">{election.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {election.isOpen ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Open</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Closed</span>
                          )}
                          {election.isOpen && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => closeElection(election.id)}
                            >
                              Close Election
                            </Button>
                          )}
                        </div>
                      </div>

                      {winner && (
                        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mb-3">
                          Winner: {getUserById(winner.userId)?.name} ({winner.votes.length} votes)
                        </p>
                      )}

                      <div className="space-y-2">
                        {election.candidates.map((c) => {
                          const user = getUserById(c.userId)
                          const pct = totalVotes > 0 ? Math.round((c.votes.length / totalVotes) * 100) : 0
                          return (
                            <div key={c.userId} className="flex items-center gap-3">
                              <span className="text-sm text-gray-700 w-28 shrink-0">{user?.name}</span>
                              <div className="flex-1">
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-purple-400 h-2 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-xs text-gray-400 w-20 text-right shrink-0">
                                {c.votes.length} votes {totalVotes > 0 && `(${pct}%)`}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  )
}
