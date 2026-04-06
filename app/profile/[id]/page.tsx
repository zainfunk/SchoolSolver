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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import AttendanceCalendar from '@/components/profile/AttendanceCalendar'
import TagEditor from '@/components/profile/TagEditor'
import {
  ExternalLink, EyeOff, Eye, Users, Shield,
  Pencil, Check, X, Plus, Trash2,
} from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-red-100 text-red-700 border-red-200',
  advisor: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-green-100 text-green-700 border-green-200',
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
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/clubs" className="hover:text-gray-800">Clubs</Link>
        <span>/</span>
        <span className="text-gray-800">{displayName}</span>
      </div>

      {/* Admin banner */}
      {isAdmin && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          Admin view — you can edit all fields on this profile.
        </div>
      )}
      {isAdvisor && attendanceClubs.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          You can see attendance for clubs you advise.
        </div>
      )}

      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            <Avatar name={displayName} size="lg" />
            <div className="flex-1 min-w-0">
              {/* Name */}
              {isAdmin && editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                    className="h-8 text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveName()} />
                  <button onClick={saveName} className="text-green-600"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingName(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
                  {isAdmin && (
                    <button onClick={() => { setNameInput(displayName); setEditingName(true) }}
                      className="text-gray-400 hover:text-gray-600 shrink-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <Badge className={`text-xs border mt-1 ${ROLE_COLORS[profileUser.role]}`}>
                {profileUser.role}
              </Badge>

              {/* Email */}
              {canSeeEmail && (
                <div className="mt-2 flex items-center gap-2">
                  {isAdmin && editingEmail ? (
                    <>
                      <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                        className="h-7 text-xs flex-1" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEmail()} />
                      <button onClick={saveEmail} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingEmail(false)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-500">{displayEmail}</span>
                      {isAdmin && (
                        <button onClick={() => { setEmailInput(displayEmail); setEditingEmail(true) }}
                          className="text-gray-400 hover:text-gray-600">
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bio</label>
              {isAdmin && !editingBio && (
                <button onClick={() => { setBioInput(profile.bio); setEditingBio(true) }}
                  className="text-gray-400 hover:text-gray-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {isAdmin && editingBio ? (
              <div>
                <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} rows={3}
                  placeholder="Write a short bio…"
                  className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  autoFocus />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { persistProfile({ bio: bioInput }); setEditingBio(false) }}
                    className="text-xs text-green-700 font-medium hover:underline">Save</button>
                  <button onClick={() => setEditingBio(false)}
                    className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">
                {profile.bio || (
                  <span className="text-gray-400 italic">
                    No bio yet.{isAdmin ? ' Click the pencil to add one.' : ''}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Socials */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Socials</label>
              {isAdmin && !editingSocials && (
                <button onClick={startEditSocials} className="text-gray-400 hover:text-gray-600">
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
                      className="text-xs border rounded px-2 py-1 w-36">
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
                <div className="flex items-center gap-2 pt-1 border-t">
                  <select value={newSocialLabel} onChange={(e) => setNewSocialLabel(e.target.value)}
                    className="text-xs border rounded px-2 py-1 w-36">
                    {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)}
                    placeholder="https://…" className="h-7 text-xs flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addSocial()} />
                  <button onClick={addSocial} className="text-blue-600 hover:text-blue-700">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveSocials} className="text-xs text-green-700 font-medium hover:underline">Save</button>
                  <button onClick={() => setEditingSocials(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.socials.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    No socials linked.{isAdmin ? ' Click the pencil to add.' : ''}
                  </p>
                ) : (
                  profile.socials.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium transition-colors">
                      <ExternalLink className="w-3 h-3" />
                      {s.label}
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardContent className="pt-5">
          <TagEditor
            label="Skills"
            presets={isAdmin ? PRESET_SKILLS : []}
            selected={profile.skills}
            onChange={isAdmin ? (skills) => persistProfile({ skills }) : () => {}}
            editable={isAdmin}
          />
        </CardContent>
      </Card>

      {/* Interests */}
      <Card>
        <CardContent className="pt-5">
          <TagEditor
            label="Interests"
            presets={isAdmin ? PRESET_INTERESTS : []}
            selected={profile.interests}
            onChange={isAdmin ? (interests) => persistProfile({ interests }) : () => {}}
            editable={isAdmin}
          />
        </CardContent>
      </Card>

      {/* Clubs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {profileUser.role === 'advisor' ? 'Clubs Advised' : 'Clubs'}
        </h3>
        <div className="space-y-2">
          {displayClubs.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No clubs.</p>
          ) : (
            displayClubs.map((club) => {
              const position = club.leadershipPositions.find((lp) => lp.userId === profileUser.id)
              return (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <Card className="hover:ring-blue-300 transition-shadow cursor-pointer">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{club.iconUrl}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">{club.name}</p>
                          {position && (
                            <Badge className="text-xs mt-0.5 border bg-yellow-50 text-yellow-700 border-yellow-200">
                              {position.title}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3.5 h-3.5" />
                          {club.memberIds.length}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* Attendance */}
      {attendanceClubs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
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
