'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import {
  USERS, CLUBS, getClubsByMember, getClubsByAdvisor,
  getAttendanceByUserAndClub,
} from '@/lib/mock-data'
import { applyOverrides, setName, setEmail } from '@/lib/user-store'
import {
  getProfile, setProfile as saveProfileStore,
  PRESET_SKILLS, PRESET_INTERESTS, SOCIAL_PLATFORMS, PersonalSocialLink,
} from '@/lib/profile-store'
import { getRecordsByClub } from '@/lib/attendance-store'
import { AttendanceRecord } from '@/types'
import Avatar from '@/components/Avatar'
import { Input } from '@/components/ui/input'
import AttendanceCalendar from '@/components/profile/AttendanceCalendar'
import TagEditor from '@/components/profile/TagEditor'
import {
  ExternalLink, EyeOff, Eye, Users, Shield,
  Pencil, Check, X, Plus, Trash2,
} from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-red-100 text-red-700 border-red-200',
  advisor: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const ROLE_DOT: Record<string, string> = {
  admin:   '#EF4444',
  advisor: '#3B82F6',
  student: '#10B981',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ViewProfilePage({ params }: PageProps) {
  const { id } = use(params)
  const { currentUser } = useMockAuth()

  const rawUser = USERS.find((u) => u.id === id)
  if (!rawUser) notFound()

  // Re-render when admin saves name/email so the display updates
  const [, forceRefresh] = useState(0)
  const profileUser = applyOverrides(rawUser)

  const viewerRole = currentUser.role
  const isAdmin = viewerRole === 'admin'
  const isAdvisor = viewerRole === 'advisor'
  const isOwnProfile = currentUser.id === profileUser.id

  // Load profile from localStorage after mount to avoid SSR/client hydration mismatch.
  const [profile, setProfileState] = useState({
    bio: '', skills: [] as string[], interests: [] as string[], socials: [] as PersonalSocialLink[],
  })
  useEffect(() => {
    setProfileState(getProfile(profileUser.id))
  }, [profileUser.id, forceRefresh])   // forceRefresh dep so edits re-read

  function persistProfile(partial: Parameters<typeof saveProfileStore>[1]) {
    saveProfileStore(profileUser.id, partial)
    setProfileState(getProfile(profileUser.id))
  }

  // ---- Admin name editing ----
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  // Track display name locally so the header updates immediately after save
  const [displayName, setDisplayName] = useState(profileUser.name)
  const [displayEmail, setDisplayEmail] = useState(profileUser.email)

  useEffect(() => {
    setDisplayName(applyOverrides(rawUser).name)
    setDisplayEmail(applyOverrides(rawUser).email)
  }, [id])

  function saveName() {
    if (!nameInput.trim()) return
    setName(profileUser.id, nameInput.trim())
    setDisplayName(nameInput.trim())
    setEditingName(false)
  }

  // ---- Admin email editing ----
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  function saveEmail() {
    if (!emailInput.trim()) return
    setEmail(profileUser.id, emailInput.trim())
    setDisplayEmail(emailInput.trim())
    setEditingEmail(false)
  }

  // ---- Bio editing ----
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState('')

  // ---- Social links editing ----
  const [editingSocials, setEditingSocials] = useState(false)
  const [socialsInput, setSocialsInput] = useState<PersonalSocialLink[]>([])
  const [newSocialLabel, setNewSocialLabel] = useState(SOCIAL_PLATFORMS[0])
  const [newSocialUrl, setNewSocialUrl] = useState('')

  function startEditSocials() {
    setSocialsInput(profile.socials.map((s) => ({ ...s })))
    setEditingSocials(true)
  }

  function saveSocials() {
    persistProfile({ socials: socialsInput.filter((s) => s.url.trim()) })
    setEditingSocials(false)
  }

  function addSocial() {
    if (!newSocialUrl.trim()) return
    setSocialsInput((prev) => [
      ...prev,
      { id: `social-${Date.now()}`, label: newSocialLabel, url: newSocialUrl.trim() },
    ])
    setNewSocialUrl('')
  }

  // ---- Clubs ----
  const memberClubs = getClubsByMember(profileUser.id)
  const advisingClubs = getClubsByAdvisor(profileUser.id)

  // ---- Attendance visibility ----
  function getVisibleAttendanceClubs() {
    if (profileUser.role !== 'student') return []
    if (isAdmin) return memberClubs
    if (isAdvisor) return memberClubs.filter((c) => c.advisorId === currentUser.id)
    if (isOwnProfile) return memberClubs
    return []
  }

  const attendanceClubs = getVisibleAttendanceClubs()

  function getClubAttendance(clubId: string): AttendanceRecord[] {
    const mock = getAttendanceByUserAndClub(profileUser.id, clubId)
    const stored = getRecordsByClub(clubId).filter((r) => r.userId === profileUser.id)
    const merged = new Map<string, AttendanceRecord>()
    for (const r of mock) merged.set(r.meetingDate, r)
    for (const r of stored) merged.set(r.meetingDate, r)
    return Array.from(merged.values()).sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
  }

  const canSeeEmail = isAdmin || isAdvisor || isOwnProfile
  const displayClubs = profileUser.role === 'advisor' ? advisingClubs : memberClubs

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#727785]">
        <Link href="/clubs" className="hover:text-[#191c1d] transition-colors">Clubs</Link>
        <span>/</span>
        <span className="text-[#191c1d] font-medium">{displayName}</span>
      </div>

      {/* Admin/advisor notice banners */}
      {isAdmin && (
        <div className="flex items-center gap-2 text-xs text-red-700 rounded-xl px-4 py-3"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.12)' }}>
          <Shield className="w-3.5 h-3.5 shrink-0" />
          Admin view — you can edit all fields on this profile.
        </div>
      )}
      {isAdvisor && attendanceClubs.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-blue-700 rounded-xl px-4 py-3"
          style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.12)' }}>
          <Eye className="w-3.5 h-3.5 shrink-0" />
          You can see attendance for clubs you advise.
        </div>
      )}

      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
        {/* Gradient banner */}
        <div className="h-24 w-full"
          style={{ background: `linear-gradient(135deg, ${ROLE_DOT[profileUser.role]}22 0%, ${ROLE_DOT[profileUser.role]}08 100%)` }} />

        <div className="px-6 pb-6">
          {/* Avatar + name row */}
          <div className="flex items-end gap-5 -mt-10 mb-4">
            <div className="rounded-full p-1 bg-white shrink-0"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <Avatar name={displayName} size="lg" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              {isAdmin && editingName ? (
                <div className="flex items-center gap-2">
                  <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                    className="h-8 text-sm max-w-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveName()} />
                  <button onClick={saveName} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingName(false)} className="text-[#727785]"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#191c1d] truncate"
                    style={{ fontFamily: 'var(--font-manrope, sans-serif)', letterSpacing: '-0.02em' }}>
                    {displayName}
                  </h1>
                  {isAdmin && (
                    <button onClick={() => { setNameInput(displayName); setEditingName(true) }}
                      className="text-[#727785] hover:text-[#191c1d] shrink-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROLE_COLORS[profileUser.role]}`}>
                  {profileUser.role}
                </span>
              </div>
            </div>
          </div>

          {/* Email */}
          {canSeeEmail && (
            <div className="flex items-center gap-2 mb-4">
              {isAdmin && editingEmail ? (
                <>
                  <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    className="h-7 text-xs max-w-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEmail()} />
                  <button onClick={saveEmail} className="text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingEmail(false)} className="text-[#727785]"><X className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <span className="text-sm text-[#727785]">{displayEmail}</span>
                  {isAdmin && (
                    <button onClick={() => { setEmailInput(displayEmail); setEditingEmail(true) }}
                      className="text-[#727785] hover:text-[#191c1d]">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bio */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Bio</label>
              {isAdmin && !editingBio && (
                <button onClick={() => { setBioInput(profile.bio); setEditingBio(true) }}
                  className="text-[#727785] hover:text-[#191c1d]">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {isAdmin && editingBio ? (
              <div>
                <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} rows={3}
                  placeholder="Write a short bio…"
                  className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0058be] resize-none"
                  style={{ background: '#f3f4f5', border: 'none' }} autoFocus />
                <div className="flex gap-3 mt-1.5">
                  <button onClick={() => { persistProfile({ bio: bioInput }); setEditingBio(false) }}
                    className="text-xs text-emerald-700 font-semibold hover:underline">Save</button>
                  <button onClick={() => setEditingBio(false)}
                    className="text-xs text-[#727785] hover:text-[#191c1d]">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#424754] leading-relaxed">
                {profile.bio || <span className="text-[#a0a3ad] italic">No bio yet.{isAdmin ? ' Click the pencil to add one.' : ''}</span>}
              </p>
            )}
          </div>

          {/* Socials */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Socials</label>
              {isAdmin && !editingSocials && (
                <button onClick={startEditSocials} className="text-[#727785] hover:text-[#191c1d]">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {isAdmin && editingSocials ? (
              <div className="space-y-2">
                {socialsInput.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <select value={s.label}
                      onChange={(e) => setSocialsInput((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                      className="text-xs rounded-lg px-2 py-1 w-32" style={{ background: '#f3f4f5', border: 'none' }}>
                      {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <Input value={s.url}
                      onChange={(e) => setSocialsInput((p) => p.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
                      placeholder="https://…" className="h-7 text-xs flex-1" />
                    <button onClick={() => setSocialsInput((p) => p.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 border-t border-[#f3f4f5]">
                  <select value={newSocialLabel} onChange={(e) => setNewSocialLabel(e.target.value)}
                    className="text-xs rounded-lg px-2 py-1 w-32" style={{ background: '#f3f4f5', border: 'none' }}>
                    {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)}
                    placeholder="https://…" className="h-7 text-xs flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addSocial()} />
                  <button onClick={addSocial} className="text-[#0058be] hover:text-[#004395]">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={saveSocials} className="text-xs text-emerald-700 font-semibold hover:underline">Save</button>
                  <button onClick={() => setEditingSocials(false)} className="text-xs text-[#727785]">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.socials.length === 0 ? (
                  <p className="text-sm text-[#a0a3ad] italic">No socials linked.</p>
                ) : (
                  profile.socials.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium text-[#424754] transition-colors"
                      style={{ background: '#f3f4f5' }}>
                      <ExternalLink className="w-3 h-3" />
                      {s.label}
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="rounded-2xl p-5"
        style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
        <TagEditor
          label="Skills & Expertise"
          presets={isAdmin ? PRESET_SKILLS : []}
          selected={profile.skills}
          onChange={isAdmin ? (skills) => persistProfile({ skills }) : () => {}}
          editable={isAdmin}
        />
      </div>

      {/* Interests */}
      <div className="rounded-2xl p-5"
        style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
        <TagEditor
          label="Interests"
          presets={isAdmin ? PRESET_INTERESTS : []}
          selected={profile.interests}
          onChange={isAdmin ? (interests) => persistProfile({ interests }) : () => {}}
          editable={isAdmin}
        />
      </div>

      {/* Clubs */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mb-3">
          {profileUser.role === 'advisor' ? 'Clubs Advised' : 'Clubs'}
        </h3>
        <div className="space-y-3">
          {displayClubs.length === 0 ? (
            <p className="text-sm text-[#727785] italic">No clubs.</p>
          ) : (
            displayClubs.map((club) => {
              const position = club.leadershipPositions.find((lp) => lp.userId === profileUser.id)
              return (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                    style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0"
                      style={{ background: '#f3f4f5' }}>
                      {club.iconUrl ?? '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#191c1d] leading-tight"
                        style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                        {club.name}
                      </p>
                      {position ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(146,71,0,0.1)', color: '#924700' }}>
                          {position.title}
                        </span>
                      ) : (
                        <span className="text-xs text-[#727785]">Member</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#727785] shrink-0">
                      <Users className="w-3.5 h-3.5" />
                      {club.memberIds.length}
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* Attendance */}
      {attendanceClubs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-700 rounded-xl px-4 py-3 mb-4"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
            {isAdmin
              ? 'Attendance is visible to you as admin.'
              : isOwnProfile
              ? 'This is your private attendance record.'
              : `Attendance for clubs you advise: ${attendanceClubs.map((c) => c.name).join(', ')}.`}
          </div>
          <div className="space-y-3">
            {attendanceClubs.map((club) => (
              <AttendanceCalendar key={club.id} clubName={club.name} records={getClubAttendance(club.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
