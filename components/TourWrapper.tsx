'use client'

import { useMockAuth } from '@/lib/mock-auth'
import { HelpTourProvider } from '@/components/HelpTour'

export default function TourWrapper({ children }: { children: React.ReactNode }) {
  const { currentUser } = useMockAuth()
  const role = currentUser.role as 'student' | 'advisor' | 'admin'

  return (
    <HelpTourProvider role={role}>
      {children}
    </HelpTourProvider>
  )
}
