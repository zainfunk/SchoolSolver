'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { USERS } from '@/lib/mock-data'
import { GraduationCap, LayoutDashboard, Calendar, FileText, Compass, User, ShieldCheck, MessageSquare } from 'lucide-react'
import Avatar from '@/components/Avatar'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-red-100 text-red-700',
  advisor: 'bg-blue-100 text-blue-700',
  student: 'bg-emerald-100 text-emerald-700',
}

const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'My Clubs',  roles: ['student', 'advisor'] },
  { href: '/events',     icon: Calendar,        label: 'Events',    roles: ['student', 'advisor', 'admin'] },
  { href: '/chat',       icon: MessageSquare,   label: 'Chat',      roles: ['student', 'advisor', 'admin'] },
  { href: '/elections',  icon: FileText,        label: 'Forms',     roles: ['student', 'advisor', 'admin'] },
  { href: '/clubs',      icon: Compass,         label: 'All Clubs', roles: ['student', 'advisor', 'admin'] },
  { href: '/profile',    icon: User,            label: 'Profile',   roles: ['student', 'advisor', 'admin'] },
  { href: '/admin',      icon: ShieldCheck,     label: 'Admin',     roles: ['admin'] },
]

export default function Sidebar() {
  const { currentUser, setCurrentUser } = useMockAuth()
  const pathname = usePathname()
  const router = useRouter()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role))

  function isActive(href: string) {
    if (href === '/profile') return pathname === '/profile' || pathname.startsWith('/profile/')
    if (href === '/clubs') return pathname === '/clubs' || pathname.startsWith('/clubs/')
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className="w-64 shrink-0 min-h-screen flex flex-col sticky top-0 h-screen overflow-y-auto"
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px)',
        boxShadow: '1px 0 0 rgba(194,198,214,0.18)',
      }}
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#0058be] flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span
            className="font-bold text-[1.05rem] text-[#191c1d] tracking-tight leading-none"
            style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
          >
            Clubit
          </span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5">
        {visibleItems.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-[#dbeafe] text-[#0058be]'
                  : 'text-[#424754] hover:bg-[#f3f4f5] hover:text-[#191c1d]'
              }`}
            >
              <Icon
                className="shrink-0"
                style={{
                  width: '1.1rem',
                  height: '1.1rem',
                  color: active ? '#0058be' : '#727785',
                }}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div
        className="px-4 pt-4 pb-5 mt-4"
        style={{ borderTop: '1px solid rgba(194,198,214,0.2)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <Link href="/profile" className="shrink-0">
            <Avatar name={currentUser.name} size="sm" />
          </Link>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold text-[#191c1d] truncate leading-tight"
              style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
            >
              {currentUser.name}
            </p>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${ROLE_BADGE[currentUser.role]}`}>
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* User switcher */}
        <select
          value={currentUser.id}
          onChange={(e) => {
            const user = USERS.find((u) => u.id === e.target.value)
            if (user) { setCurrentUser(user); router.push('/') }
          }}
          className="w-full text-xs rounded-lg px-2 py-1.5 cursor-pointer text-[#424754]"
          style={{ background: '#f3f4f5', border: 'none', outline: 'none' }}
        >
          {USERS.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
          ))}
        </select>
      </div>
    </aside>
  )
}
