'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare, Compass, User, MoreHorizontal } from 'lucide-react'

const TABS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'My Clubs' },
  { href: '/chat',      icon: MessageSquare,   label: 'Chat' },
  { href: '/clubs',     icon: Compass,         label: 'Clubs' },
  { href: '/profile',   icon: User,            label: 'Profile' },
  { href: '/settings',  icon: MoreHorizontal,  label: 'More' },
]

export default function MobileTabBar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/profile') return pathname === '/profile' || pathname.startsWith('/profile/')
    if (href === '/clubs') return pathname === '/clubs' || pathname.startsWith('/clubs/')
    if (href === '/settings') {
      return pathname === '/settings' || pathname.startsWith('/settings/') ||
             pathname === '/elections' || pathname.startsWith('/elections/') ||
             pathname === '/events' || pathname.startsWith('/events/')
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', fontFamily: 'var(--font-inter)' }}
    >
      <div className="flex items-center justify-around h-14">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 px-2 py-1 transition-colors ${
                active ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] leading-tight truncate ${active ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
