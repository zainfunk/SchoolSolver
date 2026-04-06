'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { USERS, CLUBS, getClubsByMember, getClubsByAdvisor, getAttendanceByUserAndClub } from '@/lib/mock-data'
import { getOverride, setName, setEmail, applyOverrides } from '@/lib/user-store'
import { getProfile, setProfile, PRESET_SKILLS, PRESET_INTERESTS, SOCIAL_PLATFORMS, PersonalSocialLink } from '@/lib/profile-store'
import { getRecordsByClub } from '@/lib/attendance-store'
import { AttendanceRecord } from '@/types'
import Avatar from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AttendanceCalendar from '@/components/profile/AttendanceCalendar'
import TagEditor from '@/components/profile/TagEditor'
import {
  Pencil, Check, X, Shield, Plus, Trash2,
  ExternalLink, Eye, EyeOff, BookOpen, Users,
} from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-red-100 text-red-700 border-red-200',
  advisor: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-green-100 text-green-700 border-green-200',
}

type Tab = 'overview' | 'clubs' | 'attendance'

export default function ProfilePage() {
  const { currentUser, setCurrentUser } = useMockAuth()
  const isAdmin = currentUser.role === 'admin'

  // Admin: viewing another user
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id)
  const [displayUsers, setDisplayUsers] = useState(() => USERS.map(applyOverrides))

  function refresh() { setDisplayUsers(USERS.map(applyOverrides)) }

  const profileUser = isAdmin
    ? (displayUsers.find((u) => u.id === selectedUserId) ?? displayUsers[0])
    : displayUsers.find((u) => u.id === currentUser.id)!

  const canEdit = isAdmin || profileUser.id === currentUser.id
  const isOwnProfile = profileUser.id === currentUser.id

  // ---- Profile data ----
  // Start with empty defaults so SSR and initial client render match,
  // then load real localStorage data after mount.
  const [profile, setProfileState] = useState({ bio: '', skills: [] as string[], interests: [] as string[], socials: [] as import('@/lib/profile-store').PersonalSocialLink[] })
  useEffect(() => {
    setProfileState(getProfile(profileUser.id))
  }, [profileUser.id])

  function saveProfile(partial: Parameters<typeof setProfile>[1]) {
    setProfile(profileUser.id, partial)
    setProfileState(getProfile(profileUser.id))
  }

  // ---- Name editing (admin only) ----
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  function saveName() {
    if (!nameInput.trim()) return
    setName(profileUser.id, nameInput.trim())
    refresh()
    if (profileUser.id === currentUser.id) setCurrentUser({ ...currentUser, name: nameInput.trim() })
    setEditingName(false)
  }

  // ---- Email editing ----
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  function saveEmail() {
    if (!emailInput.trim()) return
    setEmail(profileUser.id, emailInput.trim())
    refresh()
    if (profileUser.id === currentUser.id) setCurrentUser({ ...currentUser, email: emailInput.trim() })
    setEditingEmail(false)
  }

  // ---- Bio editing ----
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState('')

  // ---- Social links ----
  const [editingSocials, setEditingSocials] = useState(false)
  const [socialsInput, setSocialsInput] = useState<PersonalSocialLink[]>([])
  const [newSocialLabel, setNewSocialLabel] = useState(SOCIAL_PLATFORMS[0])
  const [newSocialUrl, setNewSocialUrl] = useState('')

  function startEditSocials() {
    setSocialsInput(profile.socials.map((s) => ({ ...s })))
    setEditingSocials(true)
  }

  function saveSocials() {
    const valid = socialsInput.filter((s) => s.url.trim())
    saveProfile({ socials: valid })
    setEditingSocials(false)
  }

  function addSocial() {
    if (!newSocialUrl.trim()) return
    const newLink: PersonalSocialLink = {
      id: `social-${Date.now()}`,
      label: newSocialLabel,
      url: newSocialUrl.trim(),
    }
    setSocialsInput((prev) => [...prev, newLink])
    setNewSocialUrl('')
  }

  // ---- Clubs ----
  const memberClubs = profileUser.role === 'student' || profileUser.role === 'admin'
    ? getClubsByMember(profileUser.id)
    : []
  const advisingClubs = profileUser.role === 'advisor' || profileUser.role === 'admin'
    ? getClubsByAdvisor(profileUser.id)
    : []

  // ---- Attendance (student only) ----
  // Merge mock + dynamic records per club
  function getClubAttendance(clubId: string): AttendanceRecord[] {
    const mock = getAttendanceByUserAndClub(profileUser.id, clubId)
    const stored = getRecordsByClub(clubId).filter((r) => r.userId === profileUser.id)
    const merged = new Map<string, AttendanceRecord>()
    for (const r of mock) merged.set(r.meetingDate, r)
    for (const r of stored) merged.set(r.meetingDate, r)
    return Array.from(merged.values()).sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
  }

  const [tab, setTab] = useState<Tab>('overview')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'clubs', label: profileUser.role === 'advisor' ? 'Clubs Advised' : 'My Clubs' },
    ...(profileUser.role === 'student' ? [{ key: 'attendance' as Tab, label: 'Attendance' }] : []),
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isOwnProfile ? 'My Profile' : `${profileUser.name}'s Profile`}
        </h1>
      </div>

      {/* Admin: user selector */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500" />
              Admin — Viewing / Editing User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value)
                setEditingName(false); setEditingEmail(false)
                setEditingBio(false); setEditingSocials(false)
                setTab('overview')
              }}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {displayUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {/* Profile header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            <Avatar name={profileUser.name} size="lg" />
            <div className="flex-1 min-w-0">
              {/* Name */}
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                    className="h-8 text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveName()} />
                  <button onClick={saveName} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingName(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900 truncate">{profileUser.name}</h2>
                  {isAdmin && (
                    <button onClick={() => { setNameInput(profileUser.name); setEditingName(true) }}
                      className="text-gray-400 hover:text-gray-600 shrink-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <Badge className={`text-xs border ${ROLE_COLORS[profileUser.role]}`}>{profileUser.role}</Badge>

              {/* Email */}
              <div className="mt-2 flex items-center gap-2">
                {editingEmail ? (
                  <>
                    <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                      className="h-7 text-xs flex-1" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEmail()} />
                    <button onClick={saveEmail} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingEmail(false)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-500">{profileUser.email}</span>
                    {canEdit && (
                      <button onClick={() => { setEmailInput(profileUser.email); setEditingEmail(true) }}
                        className="text-gray-400 hover:text-gray-600">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bio</label>
              {canEdit && !editingBio && (
                <button onClick={() => { setBioInput(profile.bio); setEditingBio(true) }}
                  className="text-gray-400 hover:text-gray-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editingBio ? (
              <div>
                <textarea
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  rows={3}
                  placeholder="Write a short bio…"
                  className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  autoFocus
                />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { saveProfile({ bio: bioInput }); setEditingBio(false) }}
                    className="text-xs text-green-700 font-medium hover:underline">Save</button>
                  <button onClick={() => setEditingBio(false)}
                    className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">
                {profile.bio || <span className="text-gray-400 italic">No bio yet.{canEdit ? ' Click the pencil to add one.' : ''}</span>}
              </p>
            )}
          </div>

          {/* Socials */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Socials</label>
              {canEdit && !editingSocials && (
                <button onClick={startEditSocials} className="text-gray-400 hover:text-gray-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {editingSocials ? (
              <div className="space-y-2">
                {socialsInput.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <select
                      value={s.label}
                      onChange={(e) => setSocialsInput((prev) => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                      className="text-xs border rounded px-2 py-1 w-36"
                    >
                      {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <Input value={s.url}
                      onChange={(e) => setSocialsInput((prev) => prev.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
                      placeholder="https://…"
                      className="h-7 text-xs flex-1" />
                    <button onClick={() => setSocialsInput((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {/* Add new */}
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
                  <p className="text-sm text-gray-400 italic">No socials linked.{canEdit ? ' Click the pencil to add.' : ''}</p>
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

      {/* Tab nav */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <TagEditor
                label="Skills"
                presets={PRESET_SKILLS}
                selected={profile.skills}
                onChange={(skills) => saveProfile({ skills })}
                editable={canEdit}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <TagEditor
                label="Interests"
                presets={PRESET_INTERESTS}
                selected={profile.interests}
                onChange={(interests) => saveProfile({ interests })}
                editable={canEdit}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Clubs */}
      {tab === 'clubs' && (
        <div className="space-y-3">
          {profileUser.role === 'advisor' || profileUser.role === 'admin' ? (
            advisingClubs.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">Not advising any clubs.</p>
            ) : (
              advisingClubs.map((club) => (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <Card className="hover:ring-blue-300 transition-shadow cursor-pointer">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{club.iconUrl}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">{club.name}</p>
                          <p className="text-xs text-gray-500 truncate">{club.description}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Users className="w-3.5 h-3.5" />
                          {club.memberIds.length}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )
          ) : (
            memberClubs.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-4">Not a member of any clubs yet.</p>
            ) : (
              memberClubs.map((club) => {
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
            )
          )}
        </div>
      )}

      {/* Tab: Attendance (student only, visible to self and admins) */}
      {tab === 'attendance' && profileUser.role === 'student' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            Attendance is private — only visible to you and your club advisors.
          </div>
          {memberClubs.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-4">No club memberships to show attendance for.</p>
          ) : (
            memberClubs.map((club) => (
              <AttendanceCalendar
                key={club.id}
                clubName={club.name}
                records={getClubAttendance(club.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
