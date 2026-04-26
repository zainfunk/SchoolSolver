'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, MapPin, User, Copy, CheckCircle, AlertTriangle, LogIn, Sparkles } from 'lucide-react'
import RocketLoader from '@/components/ui/RocketLoader'
import { FadeIn, Stagger } from '@/components/ui/FadeIn'

interface Codes {
  schoolName: string
  schoolId?: string
  studentInviteCode: string
  adminInviteCode: string
  advisorInviteCode: string
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { isLoaded: clerkLoaded, isSignedIn, user } = useUser()

  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', district: '', contactName: '' })
  const [loading, setLoading] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [codes, setCodes] = useState<Codes | null>(null)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setEmail(d.email)
      })
      .catch(() => setError('Failed to load invite'))
  }, [token])

  // Prefill the contact name from Clerk once the user is signed in.
  useEffect(() => {
    if (!isSignedIn || !user) return
    setForm(prev => prev.contactName ? prev : { ...prev, contactName: user.fullName ?? user.username ?? '' })
  }, [isSignedIn, user])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      // Hold the rocket loader briefly so the success state lands.
      setLaunched(true)
      setTimeout(() => setCodes(data), 1100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error && !codes) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <FadeIn className="text-center max-w-sm">
          <motion.div
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mb-4"
          >
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </motion.div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invite unavailable</h1>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-xs text-gray-400 mt-4">
            Contact <a href="mailto:support@clubit.app" className="underline">support@clubit.app</a> for help.
          </p>
        </FadeIn>
      </div>
    )
  }

  // ── Success state — show invite codes ─────────────────────────────────────
  if (codes) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <FadeIn className="text-center mb-8" y={20}>
            <motion.div
              initial={{ scale: 0.5, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl mb-4 shadow-lg shadow-emerald-500/30"
            >
              <CheckCircle className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900">{codes.schoolName} is live!</h1>
            <p className="text-gray-500 text-sm mt-1">You&apos;re the admin. Share these codes with your community.</p>
          </FadeIn>

          <Stagger className="space-y-4" stagger={0.08} delay={0.2}>
            <Stagger.Item>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Student invite code</p>
                    <p className="text-sm text-gray-500 mt-0.5">Share with all students</p>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">Students</span>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <code className="text-lg font-mono font-bold tracking-widest text-gray-900">{codes.studentInviteCode}</code>
                  <CopyButton value={codes.studentInviteCode} />
                </div>
              </div>
            </Stagger.Item>

            <Stagger.Item>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Advisor invite code</p>
                    <p className="text-sm text-gray-500 mt-0.5">Share with club advisors and teachers</p>
                  </div>
                  <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium">Advisors</span>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <code className="text-lg font-mono font-bold tracking-widest text-gray-900">{codes.advisorInviteCode}</code>
                  <CopyButton value={codes.advisorInviteCode} />
                </div>
                <p className="text-xs text-purple-600 mt-3">Advisors can create and manage clubs they own.</p>
              </div>
            </Stagger.Item>

            <Stagger.Item>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Admin invite code</p>
                    <p className="text-sm text-gray-500 mt-0.5">Share only with staff administrators</p>
                  </div>
                  <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium">Admins</span>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <code className="text-lg font-mono font-bold tracking-widest text-gray-900">{codes.adminInviteCode}</code>
                  <CopyButton value={codes.adminInviteCode} />
                </div>
                <p className="text-xs text-amber-600 mt-3">Keep this code private — it grants admin access.</p>
              </div>
            </Stagger.Item>

            <Stagger.Item>
              <Link
                href="/admin"
                className="block w-full bg-black text-white text-center py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Go to your admin dashboard →
              </Link>
            </Stagger.Item>
          </Stagger>
        </div>
      </div>
    )
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (!email || !clerkLoaded) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30"
            animate={{ rotate: [0, 90, 180, 270, 360], scale: [1, 1.1, 1, 1.1, 1], borderRadius: ['16px', '50%', '16px', '50%', '16px'] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <p className="text-gray-400 text-sm tracking-wide">Loading your invite…</p>
        </div>
      </div>
    )
  }

  // ── Auth-required state — visitor isn't signed in yet ────────────────────────
  if (!isSignedIn) {
    const redirectTarget = encodeURIComponent(`/invite/${token}`)
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <FadeIn className="w-full max-w-md text-center" y={20}>
          <motion.div
            initial={{ scale: 0.5, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.05 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl mb-5 shadow-lg shadow-blue-500/30"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900">You&apos;re invited to ClubIt</h1>
          <p className="text-gray-500 text-sm mt-2 mb-1">
            Invite sent to <span className="font-medium text-gray-700">{email}</span>
          </p>
          <p className="text-gray-500 text-sm mb-2">
            Create your admin account first — you&apos;ll need it to sign back in to ClubIt later.
          </p>
          <p className="text-xs text-gray-400 mb-7">
            On the next screen you&apos;ll set up your school and unlock your admin role.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link
              href={`/sign-up?redirect_url=${redirectTarget}`}
              className="flex items-center justify-center gap-2 w-full bg-[#0058be] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#0047a0] transition-colors shadow-lg shadow-blue-500/20"
            >
              <LogIn className="w-4 h-4" />
              Create your admin account
            </Link>
            <Link
              href={`/sign-in?redirect_url=${redirectTarget}`}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors mt-1"
            >
              Already have a ClubIt account? Sign in
            </Link>
          </div>
        </FadeIn>
      </div>
    )
  }

  // ── Form state — signed in, fill out school details ──────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <AnimatePresence>
        {loading && (
          <RocketLoader
            open
            done={launched}
            label={launched ? 'Welcome aboard!' : 'Launching your school…'}
            subLabel={launched ? 'Spinning up your admin dashboard.' : 'Creating your school and unlocking your admin role.'}
          />
        )}
      </AnimatePresence>

      <div className="w-full max-w-lg">
        <FadeIn className="text-center mb-8" y={20}>
          <motion.div
            initial={{ scale: 0.5, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.05 }}
            className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-2xl mb-4"
          >
            <Building2 className="w-7 h-7 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your school</h1>
          <p className="text-gray-500 text-sm mt-1">
            Signed in as <span className="font-medium text-gray-700">{user?.primaryEmailAddress?.emailAddress ?? email}</span>
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">School name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Oakridge High School"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                School district <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={form.district}
                  onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                  placeholder="Oakridge Unified School District"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  placeholder="Principal or IT contact"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Launching…' : 'Set up school & become admin'}
            </button>
          </form>
        </FadeIn>
      </div>
    </div>
  )
}
