'use client'

import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS, JOIN_REQUESTS, getUserById, getClubsByAdvisor } from '@/lib/mock-data'
import ClubCard from '@/components/clubs/ClubCard'
import { Users, BookOpen } from 'lucide-react'
import type { Club } from '@/types'

function getPattern(club: Club): 'chess' | 'art' | 'robotics' {
  const tags = (club.tags ?? []).map((t) => t.toLowerCase())
  if (tags.some((t) => ['stem', 'engineering', 'technology', 'robotics'].includes(t))) return 'robotics'
  if (tags.some((t) => ['arts', 'art', 'performance', 'theatre', 'music', 'creative'].includes(t))) return 'art'
  return 'chess'
}

const PATTERN_ICON_STYLES: Record<string, { bg: string; text: string }> = {
  robotics: { bg: 'rgba(0, 88, 190, 0.08)', text: '#0058be' },
  art:      { bg: 'rgba(16, 185, 129, 0.08)', text: '#059669' },
  chess:    { bg: '#edeeef', text: '#374151' },
}

export default function DashboardPage() {
  const { currentUser } = useMockAuth()

  if (currentUser.role === 'student') {
    const myClubs = CLUBS.filter((c) => c.memberIds.includes(currentUser.id))
    const pendingRequests = JOIN_REQUESTS.filter(
      (r) => r.userId === currentUser.id && r.status === 'pending'
    )
    const firstName = currentUser.name.split(' ')[0]

    return (
      <div className="max-w-2xl mx-auto">
        {/* Welcome Banner */}
        <section className="mb-10">
          <div className="p-6 rounded-xl" style={{ background: 'rgba(33, 112, 228, 0.08)', border: '1px solid rgba(0, 88, 190, 0.1)' }}>
            <h2 className="text-3xl font-extrabold text-[#191c1d] tracking-tight leading-none mb-2"
              style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
              Hi, {firstName}!
            </h2>
            {pendingRequests.length > 0 && (
              <p className="font-medium text-[#0058be]">
                You have {pendingRequests.length} pending club request{pendingRequests.length !== 1 ? 's' : ''}.
              </p>
            )}
          </div>
        </section>

        {/* Club List */}
        <div className="flex flex-col gap-6">
          {myClubs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">You haven't joined any clubs yet.</p>
            </div>
          ) : (
            myClubs.map((club) => {
              const advisor = getUserById(club.advisorId)
              const pattern = getPattern(club)
              const iconStyle = PATTERN_ICON_STYLES[pattern]
              return (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <div
                    className="relative overflow-hidden bg-white rounded-xl p-6 transition-all duration-300 hover:scale-[1.01] cursor-pointer"
                    style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}
                  >
                    {/* Decorative pattern */}
                    <div className={`absolute right-0 top-0 w-[40%] h-full editorial-pattern-${pattern}`} />
                    {/* Card content */}
                    <div className="relative z-10 flex items-center gap-5">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: iconStyle.bg }}
                      >
                        {club.iconUrl ?? '📌'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="mb-1">
                          <span
                            className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(146, 71, 0, 0.1)', color: '#924700' }}
                          >
                            {currentUser.role}
                          </span>
                        </div>
                        <h3
                          className="font-bold text-[#191c1d] leading-tight text-lg"
                          style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
                        >
                          {club.name}
                        </h3>
                        {advisor && (
                          <p className="text-sm font-medium text-[#727785]">Advisor: {advisor.name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })
          )}

          {/* Explore All Clubs CTA */}
          <div
            className="mt-8 rounded-xl p-8 flex flex-col items-center text-center"
            style={{ border: '2px dashed rgba(194, 198, 214, 0.4)' }}
          >
            <p className="text-sm font-medium text-[#727785] mb-4">Want to expand your horizons?</p>
            <Link href="/clubs">
              <button
                className="font-bold py-3 px-8 rounded-full text-sm uppercase tracking-widest transition-colors hover:bg-gray-200"
                style={{ background: '#e1e3e4', color: '#191c1d', fontFamily: 'var(--font-manrope, sans-serif)' }}
              >
                EXPLORE ALL CLUBS
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (currentUser.role === 'advisor') {
    const myClubs = getClubsByAdvisor(currentUser.id)

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Clubs</h1>
          <p className="text-sm text-gray-500 mt-1">Clubs you advise, {currentUser.name}</p>
        </div>

        {myClubs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">You are not assigned as advisor to any clubs yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myClubs.map((club) => (
              <ClubCard key={club.id} club={club} advisor={currentUser} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-center py-20">
      <p className="text-gray-500">
        As an admin, your dashboard is the{' '}
        <Link href="/admin" className="text-blue-600 underline">
          Admin Panel
        </Link>.
      </p>
    </div>
  )
}
