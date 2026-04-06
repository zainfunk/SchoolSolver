'use client'

import { useEffect, createContext, useContext, useState, useCallback } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { getAppSettings, setAppSettings } from '@/lib/settings-store'

interface SettingsContextValue {
  darkMode: boolean
  toggleDarkMode: () => void
}

const SettingsContext = createContext<SettingsContextValue>({
  darkMode: false,
  toggleDarkMode: () => {},
})

export const useAppSettings = () => useContext(SettingsContext)

export default function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useMockAuth()
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const s = getAppSettings(currentUser.id)
    setDarkMode(s.darkMode)
    document.documentElement.classList.toggle('dark', s.darkMode)
  }, [currentUser.id])

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev
      setAppSettings(currentUser.id, { darkMode: next })
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }, [currentUser.id])

  return (
    <SettingsContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </SettingsContext.Provider>
  )
}
