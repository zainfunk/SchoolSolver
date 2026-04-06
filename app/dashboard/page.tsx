'use client'

import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS, JOIN_REQUESTS, getUserById, getClubsByAdvisor } from '@/lib/mock-data'
import ClubCard from '@/components/clubs/ClubCard'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Users, BookOpen, Clock } from 'lucide-react'

export default function DashboardPage() {
  const { currentUser } = useMockAuth()

  if (currentUser.role === 'student') {
    const myClubs = CLUBS.filter((c) => c.memberIds.includes(currentUser.id))
    const pendingRequests = JOIN_REQUESTS.filter(
      (r) => r.userId === currentUser.id && r.status === 'pending'
    )

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Clubs</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {currentUser.name}</p>
        </div>

        {/* Pending requests banner */}
        {pendingRequests.length > 0 && (
          <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-medium text-blue-800">
                {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-1">
              {pendingRequests.map((req) => {
                const club = CLUBS.find((c) => c.id === req.clubId)
                return (
                  <div key={req.id} className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{club?.iconUrl ?? '📌'}</span>
                    <Link
                      href={`/clubs/${req.clubId}`}
                      className="text-sm text-blue-700 hover:underline"
                    >
                      {club?.name ?? req.clubId}
                    </Link>
                    <span className="text-xs text-gray-400">— awaiting advisor review</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {myClubs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">You haven't joined any clubs yet.</p>
            <Link href="/clubs" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4 inline-flex')}>
              Browse Clubs
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myClubs.map((club) => {
              const advisor = getUserById(club.advisorId)
              return <ClubCard key={club.id} club={club} advisor={advisor} isMember />
            })}
          </div>
        )}

        <div className="mt-6">
          <Link href="/clubs" className={cn(buttonVariants({ variant: 'outline' }))}>
            Browse All Clubs
          </Link>
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
