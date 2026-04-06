'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import {
  CLUBS, MEMBERSHIPS, JOIN_REQUESTS, POLLS,
  getUserById, getEventsByClub, getAttendanceByClub, getNewsByClub, USERS,
} from '@/lib/mock-data'
import {
  getSessionsByClub, saveSession, upsertRecord, getRecordsByClub,
} from '@/lib/attendance-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Clock, MapPin, Globe, Calendar, Crown, CheckCircle, XCircle,
  ClockIcon, Vote, Plus, Trash2, UserCheck, Pencil, Newspaper, Camera,
  MessageCircle, Tv, Video, Link as LinkIcon, QrCode, Copy, ArrowLeft,
} from 'lucide-react'
import { JoinRequest, LeadershipPosition, Poll, ClubEvent, ClubNews, SocialLink, SocialPlatform, MeetingTime, AttendanceRecord, AttendanceSession } from '@/types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  const cls = 'w-4 h-4'
  switch (platform) {
    case 'instagram': return <Camera className={cls} />
    case 'twitter':   return <MessageCircle className={cls} />
    case 'facebook':  return <Tv className={cls} />
    case 'youtube':   return <Video className={cls} />
    case 'website':   return <Globe className={cls} />
    default:          return <LinkIcon className={cls} />
  }
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram', twitter: 'Twitter', facebook: 'Facebook',
  youtube: 'YouTube', discord: 'Discord', website: 'Website', other: 'Other',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ClubDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { currentUser } = useMockAuth()

  // Core state
  const [clubs, setClubs] = useState(CLUBS)
  const [memberships, setMemberships] = useState(MEMBERSHIPS)
  const [requests, setRequests] = useState<JoinRequest[]>(JOIN_REQUESTS)
  const [polls, setPolls] = useState<Poll[]>(POLLS)
  const [clubEvents, setClubEvents] = useState<ClubEvent[]>(() => getEventsByClub(id))
  const [clubNews, setClubNews] = useState<ClubNews[]>(() => getNewsByClub(id))

  // Edit mode for club header info (advisor)
  const [editMode, setEditMode] = useState(false)
  const [editIcon, setEditIcon] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editSocialLinks, setEditSocialLinks] = useState<SocialLink[]>([])
  const [newSocialPlatform, setNewSocialPlatform] = useState<SocialPlatform>('instagram')
  const [newSocialUrl, setNewSocialUrl] = useState('')

  // Leadership management
  const [newPositionTitle, setNewPositionTitle] = useState('')
  const [appointSelections, setAppointSelections] = useState<Record<string, string>>({})

  // Capacity editing
  const [editingCapacity, setEditingCapacity] = useState(false)
  const [capacityInput, setCapacityInput] = useState('')
  const [capacityUnlimited, setCapacityUnlimited] = useState(false)

  // Meeting time management
  const [newMeetingDay, setNewMeetingDay] = useState<number>(1)
  const [newMeetingStart, setNewMeetingStart] = useState('15:00')
  const [newMeetingEnd, setNewMeetingEnd] = useState('16:00')
  const [newMeetingLocation, setNewMeetingLocation] = useState('')

  // Event creation
  const [showEventForm, setShowEventForm] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDesc, setNewEventDesc] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventLocation, setNewEventLocation] = useState('')
  const [newEventPublic, setNewEventPublic] = useState(true)

  // News creation
  const [showNewsForm, setShowNewsForm] = useState(false)
  const [newNewsTitle, setNewNewsTitle] = useState('')
  const [newNewsContent, setNewNewsContent] = useState('')
  const [newNewsPinned, setNewNewsPinned] = useState(false)

  // Poll creation
  const [showPollForm, setShowPollForm] = useState(false)
  const [pollPositionTitle, setPollPositionTitle] = useState('')
  const [pollCandidateIds, setPollCandidateIds] = useState<string[]>([])

  // Attendance state (merges static mock data + localStorage records)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const staticRecs = getAttendanceByClub(id)
    const stored = getRecordsByClub(id)
    const merged = [...staticRecs]
    for (const r of stored) {
      const idx = merged.findIndex(
        (m) => m.clubId === r.clubId && m.userId === r.userId && m.meetingDate === r.meetingDate
      )
      if (idx >= 0) merged[idx] = r
      else merged.push(r)
    }
    return merged
  })

  // QR / attendance session state (advisor)
  const [sessions, setSessions] = useState<AttendanceSession[]>(() => getSessionsByClub(id))
  const [showQrForm, setShowQrForm] = useState(false)
  const [qrDate, setQrDate] = useState(() => new Date().toISOString().split('T')[0])
  const [qrExpiry, setQrExpiry] = useState(30) // minutes
  const [qrDistance, setQrDistance] = useState(0) // meters, 0 = disabled
  const [qrCaptureLocation, setQrCaptureLocation] = useState(false)
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)
  const [copied, setCopied] = useState(false)

  // Manual attendance editing (advisor)
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showManual, setShowManual] = useState(false)

  const foundClub = clubs.find((c) => c.id === id)
  if (!foundClub) notFound()
  const club = foundClub!

  const advisor = getUserById(club.advisorId)
  const members = club.memberIds.map((mid) => getUserById(mid)).filter(Boolean)

  const isMember = club.memberIds.includes(currentUser.id)
  const isAdvisor = currentUser.role === 'advisor' && club.advisorId === currentUser.id
  const canCreateContent = isAdvisor || club.eventCreatorIds.includes(currentUser.id)
  const isFull = club.capacity !== null && club.memberIds.length >= club.capacity

  const myRequest = requests.find((r) => r.clubId === id && r.userId === currentUser.id)
  const pendingRequests = requests
    .filter((r) => r.clubId === id && r.status === 'pending')
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())

  const clubPolls = polls.filter((p) => p.clubId === id)

  // Per-member attendance
  const memberAttendance = club.memberIds.map((mid) => {
    const user = getUserById(mid)
    const records = attendanceRecords.filter((r) => r.userId === mid)
    const present = records.filter((r) => r.present).length
    return { user, records, total: records.length, present }
  })

  // My attendance (student)
  const myAttendance = attendanceRecords.filter((r) => r.userId === currentUser.id)
  const myPresent = myAttendance.filter((r) => r.present).length

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // --- Join request handlers ---
  function handleRequest() {
    const autoApprove = club.autoAccept && !isFull
    const newRequest: JoinRequest = {
      id: `req-${Date.now()}`, clubId: id, userId: currentUser.id,
      requestedAt: new Date().toISOString(), status: autoApprove ? 'approved' : 'pending',
    }
    setRequests((prev) => [...prev, newRequest])
    if (autoApprove) {
      setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: [...c.memberIds, currentUser.id] } : c))
      setMemberships((prev) => [...prev, { id: `m-${Date.now()}`, clubId: id, userId: currentUser.id, joinedAt: new Date().toISOString().split('T')[0] }])
    }
  }

  function handleLeave() {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: c.memberIds.filter((mid) => mid !== currentUser.id) } : c))
    setMemberships((prev) => prev.filter((m) => !(m.clubId === id && m.userId === currentUser.id)))
    setRequests((prev) => prev.filter((r) => !(r.clubId === id && r.userId === currentUser.id)))
  }

  function handleApprove(requestId: string) {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'approved' } : r))
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: [...c.memberIds, req.userId] } : c))
    setMemberships((prev) => [...prev, { id: `m-${Date.now()}`, clubId: id, userId: req.userId, joinedAt: new Date().toISOString().split('T')[0] }])
  }

  function handleReject(requestId: string) {
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'rejected' } : r))
  }

  function toggleAutoAccept() {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, autoAccept: !c.autoAccept } : c))
  }

  // --- Edit mode ---
  function startEdit() {
    setEditIcon(club.iconUrl ?? '')
    setEditDescription(club.description)
    setEditTags(club.tags?.join(', ') ?? '')
    setEditSocialLinks([...club.socialLinks])
    setEditMode(true)
  }

  function saveEdit() {
    setClubs((prev) => prev.map((c) => c.id === id ? {
      ...c,
      iconUrl: editIcon.trim() || c.iconUrl,
      description: editDescription.trim() || c.description,
      tags: editTags ? editTags.split(',').map((t) => t.trim()).filter(Boolean) : c.tags,
      socialLinks: editSocialLinks,
    } : c))
    setEditMode(false)
  }

  function addSocialLink() {
    if (!newSocialUrl.trim()) return
    setEditSocialLinks((prev) => [...prev, { platform: newSocialPlatform, url: newSocialUrl.trim() }])
    setNewSocialUrl('')
  }

  function removeSocialLink(i: number) {
    setEditSocialLinks((prev) => prev.filter((_, idx) => idx !== i))
  }

  // --- Capacity ---
  function startEditCapacity() {
    setCapacityUnlimited(club.capacity === null)
    setCapacityInput(club.capacity !== null ? String(club.capacity) : '')
    setEditingCapacity(true)
  }

  function saveCapacity() {
    const newCap = capacityUnlimited ? null : Math.max(club.memberIds.length, parseInt(capacityInput) || 1)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, capacity: newCap } : c))
    setEditingCapacity(false)
  }

  // --- Leadership ---
  function addPosition() {
    const title = newPositionTitle.trim()
    if (!title) return
    const newPos: LeadershipPosition = { id: `lp-${Date.now()}`, title, userId: undefined }
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: [...c.leadershipPositions, newPos] } : c))
    setNewPositionTitle('')
  }

  function removePosition(posId: string) {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.filter((p) => p.id !== posId) } : c))
  }

  function appointMember(posId: string) {
    const userId = appointSelections[posId]
    if (!userId) return
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.map((p) => p.id === posId ? { ...p, userId } : p) } : c))
    setAppointSelections((prev) => ({ ...prev, [posId]: '' }))
  }

  function removeAppointment(posId: string) {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.map((p) => p.id === posId ? { ...p, userId: undefined } : p) } : c))
  }

  // --- Meeting times ---
  function addMeetingTime() {
    if (!newMeetingStart || !newMeetingEnd) return
    const newMt: MeetingTime = {
      id: `mt-${Date.now()}`, dayOfWeek: newMeetingDay as MeetingTime['dayOfWeek'],
      startTime: newMeetingStart, endTime: newMeetingEnd,
      location: newMeetingLocation.trim() || undefined,
    }
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, meetingTimes: [...c.meetingTimes, newMt] } : c))
    setNewMeetingLocation('')
  }

  function removeMeetingTime(mtId: string) {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, meetingTimes: c.meetingTimes.filter((m) => m.id !== mtId) } : c))
  }

  // --- Event permissions ---
  function toggleEventCreator(userId: string) {
    setClubs((prev) => prev.map((c) => c.id === id ? {
      ...c,
      eventCreatorIds: c.eventCreatorIds.includes(userId)
        ? c.eventCreatorIds.filter((uid) => uid !== userId)
        : [...c.eventCreatorIds, userId],
    } : c))
  }

  // --- Events ---
  function createEvent() {
    if (!newEventTitle.trim() || !newEventDate) return
    const ev: ClubEvent = {
      id: `event-${Date.now()}`, clubId: id,
      title: newEventTitle.trim(), description: newEventDesc.trim(),
      date: newEventDate, location: newEventLocation.trim() || undefined,
      isPublic: newEventPublic, createdBy: currentUser.id,
    }
    setClubEvents((prev) => [...prev, ev].sort((a, b) => a.date.localeCompare(b.date)))
    setNewEventTitle(''); setNewEventDesc(''); setNewEventDate(''); setNewEventLocation(''); setNewEventPublic(true)
    setShowEventForm(false)
  }

  function deleteEvent(eventId: string) {
    setClubEvents((prev) => prev.filter((e) => e.id !== eventId))
  }

  // --- News ---
  function postNews() {
    if (!newNewsTitle.trim() || !newNewsContent.trim()) return
    const news: ClubNews = {
      id: `news-${Date.now()}`, clubId: id,
      title: newNewsTitle.trim(), content: newNewsContent.trim(),
      authorId: currentUser.id, createdAt: new Date().toISOString(), isPinned: newNewsPinned,
    }
    setClubNews((prev) => {
      const updated = [...prev, news].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      return updated
    })
    setNewNewsTitle(''); setNewNewsContent(''); setNewNewsPinned(false)
    setShowNewsForm(false)
  }

  function deleteNews(newsId: string) {
    setClubNews((prev) => prev.filter((n) => n.id !== newsId))
  }

  // --- Polls ---
  function togglePollCandidate(userId: string) {
    setPollCandidateIds((prev) => prev.includes(userId) ? prev.filter((uid) => uid !== userId) : [...prev, userId])
  }

  function createPoll() {
    if (!pollPositionTitle.trim() || pollCandidateIds.length < 2) return
    const newPoll: Poll = {
      id: `poll-${Date.now()}`, clubId: id, positionTitle: pollPositionTitle.trim(),
      candidates: pollCandidateIds.map((uid) => ({ userId: uid, votes: [] })),
      createdAt: new Date().toISOString(), isOpen: true,
    }
    setPolls((prev) => [...prev, newPoll])
    setPollPositionTitle(''); setPollCandidateIds([]); setShowPollForm(false)
  }

  function castVote(pollId: string, candidateUserId: string) {
    setPolls((prev) => prev.map((p) => p.id === pollId ? {
      ...p, candidates: p.candidates.map((c) => c.userId === candidateUserId ? { ...c, votes: [...c.votes, currentUser.id] } : c),
    } : p))
  }

  function closePoll(pollId: string) {
    setPolls((prev) => prev.map((p) => p.id === pollId ? { ...p, isOpen: false } : p))
  }

  function appointPollWinner(pollId: string) {
    const poll = polls.find((p) => p.id === pollId)
    if (!poll) return
    const winner = poll.candidates.reduce((a, b) => a.votes.length >= b.votes.length ? a : b)
    setClubs((prev) => prev.map((c) => c.id === id ? {
      ...c, leadershipPositions: c.leadershipPositions.map((p) =>
        p.title.toLowerCase() === poll.positionTitle.toLowerCase() ? { ...p, userId: winner.userId } : p
      ),
    } : c))
    closePoll(pollId)
  }

  // --- QR / attendance session handlers ---

  async function generateQr() {
    let lat: number | undefined
    let lng: number | undefined
    if (qrCaptureLocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch { /* location unavailable — skip */ }
    }
    const session: AttendanceSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clubId: id,
      meetingDate: qrDate,
      createdBy: currentUser.id,
      expiresAt: new Date(Date.now() + qrExpiry * 60_000).toISOString(),
      maxDistanceMeters: qrDistance,
      advisorLat: lat,
      advisorLng: lng,
      recordedUserIds: [],
    }
    saveSession(session)
    setSessions((prev) => [...prev, session])
    setActiveSession(session)
    setShowQrForm(false)
  }

  function getAttendUrl(session: AttendanceSession): string {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/attend?t=${session.id}`
  }

  function copyLink(session: AttendanceSession) {
    navigator.clipboard.writeText(getAttendUrl(session))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- Manual attendance handlers ---

  function setManualAttendance(userId: string, present: boolean) {
    upsertRecord(id, userId, manualDate, present)
    setAttendanceRecords((prev) => {
      const next = [...prev]
      const idx = next.findIndex(
        (r) => r.clubId === id && r.userId === userId && r.meetingDate === manualDate
      )
      const rec: AttendanceRecord = {
        id: idx >= 0 ? next[idx].id : `att-manual-${Date.now()}`,
        clubId: id, userId, meetingDate: manualDate, present,
      }
      if (idx >= 0) next[idx] = rec
      else next.push(rec)
      return next
    })
  }

  // ======================== RENDER ========================

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Back ── */}
      <Link href="/clubs" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />All Clubs
      </Link>

      {/* ── Header ── */}
      <div className="bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.04)] mb-5">
        {editMode ? (
          <div className="p-7 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Editing Club Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Icon (emoji)</label>
                <Input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} placeholder="🤖" className="text-2xl h-10" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tags (comma separated)</label>
                <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="STEM, Arts…" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3}
                className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Social Links</label>
              <div className="space-y-1.5 mb-2">
                {editSocialLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <SocialIcon platform={link.platform} />
                    <span className="text-sm text-gray-600 flex-1 truncate">{link.url}</span>
                    <button onClick={() => removeSocialLink(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <select value={newSocialPlatform} onChange={(e) => setNewSocialPlatform(e.target.value as SocialPlatform)}
                  className="text-sm bg-gray-50 rounded-lg px-2 py-1.5 focus:outline-none border-none">
                  {(Object.keys(PLATFORM_LABELS) as SocialPlatform[]).map((p) => (
                    <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                  ))}
                </select>
                <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)} placeholder="https://…" className="flex-1 h-8 text-sm" />
                <button onClick={addSocialLink} className="text-[#0058be] hover:text-blue-800 transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} className="bg-[#0058be] text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-blue-700 transition-colors">
                Save Changes
              </button>
              <button onClick={() => setEditMode(false)} className="bg-gray-100 text-gray-700 rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-7">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-3xl shrink-0">
                  {club.iconUrl ?? '📌'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#191c1d] leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
                    {club.name}
                  </h1>
                  {advisor && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      Advisor:{' '}
                      <Link href={`/profile/${advisor.id}`} className="hover:text-[#0058be] hover:underline transition-colors">
                        {advisor.name}
                      </Link>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {club.tags?.map((tag) => (
                      <span key={tag} className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {club.socialLinks.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="text-gray-300 hover:text-gray-600 transition-colors" title={PLATFORM_LABELS[link.platform]}>
                    <SocialIcon platform={link.platform} />
                  </a>
                ))}
                {isAdvisor && (
                  <>
                    <button onClick={startEdit}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />Edit
                    </button>
                    <button onClick={toggleAutoAccept}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        club.autoAccept ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${club.autoAccept ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      Auto-accept {club.autoAccept ? 'on' : 'off'}
                    </button>
                  </>
                )}
                {currentUser.role === 'student' && (
                  isMember ? (
                    <button onClick={handleLeave}
                      className="text-xs font-bold text-gray-500 border border-gray-200 hover:border-red-200 hover:text-red-500 rounded-xl px-4 py-2 transition-colors">
                      Leave Club
                    </button>
                  ) : myRequest?.status === 'pending' ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-100 rounded-xl px-4 py-2">
                      <ClockIcon className="w-3.5 h-3.5" />Pending
                    </span>
                  ) : myRequest?.status === 'rejected' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-500 font-medium">Request declined</span>
                      <button onClick={handleRequest}
                        className="text-xs font-bold bg-[#0058be] text-white rounded-xl px-4 py-2 hover:bg-blue-700 transition-colors">
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <button onClick={handleRequest}
                        className="text-xs font-bold bg-[#0058be] text-white rounded-xl px-4 py-2 hover:bg-blue-700 transition-colors">
                        Request to Join
                      </button>
                      {isFull && <span className="text-[10px] text-gray-400">Club is full — manual approval</span>}
                    </div>
                  )
                )}
              </div>
            </div>

            <p className="text-gray-500 text-sm leading-relaxed mt-5">{club.description}</p>

            {currentUser.role === 'student' && !isMember && !myRequest && (
              <p className="text-xs text-gray-400 mt-2">
                {club.autoAccept && !isFull ? "Auto-accepts — you'll be added immediately."
                  : club.autoAccept && isFull ? 'Club is at capacity — request will be reviewed manually.'
                  : 'Requests reviewed manually by the advisor.'}
              </p>
            )}

            {club.capacity !== null && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Capacity</span>
                  <span className="text-[10px] font-bold text-gray-500">{club.memberIds.length} / {club.capacity}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min((club.memberIds.length / club.capacity) * 100, 100)}%`,
                      background: club.memberIds.length / club.capacity >= 0.9 ? '#ef4444' : '#0058be',
                    }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* ── Left column ── */}
        <div className="md:col-span-2 space-y-5">

          {/* Members */}
          <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />Members · {club.memberIds.length}/{club.capacity === null ? '∞' : club.capacity}
              </h3>
              {isAdvisor && !editingCapacity && (
                <button onClick={startEditCapacity} className="text-xs font-medium text-[#0058be] hover:underline">Edit limit</button>
              )}
            </div>
            {isAdvisor && editingCapacity && (
              <div className="mb-4 flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={capacityUnlimited} onChange={(e) => setCapacityUnlimited(e.target.checked)} />
                  Unlimited
                </label>
                {!capacityUnlimited && (
                  <Input type="number" min={club.memberIds.length} value={capacityInput}
                    onChange={(e) => setCapacityInput(e.target.value)} className="w-24 h-8 text-sm" />
                )}
                <button onClick={saveCapacity} className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors">Save</button>
                <button onClick={() => setEditingCapacity(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            )}
            {club.capacity !== null && (
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                <div className="h-1.5 rounded-full bg-[#0058be] transition-all"
                  style={{ width: `${Math.min((club.memberIds.length / club.capacity) * 100, 100)}%` }} />
              </div>
            )}
            <div className="space-y-0">
              {members.map((member) => {
                if (!member) return null
                const positions = club.leadershipPositions.filter((lp) => lp.userId === member.id)
                const canCreate = club.eventCreatorIds.includes(member.id)
                return (
                  <div key={member.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/profile/${member.id}`} className="text-sm font-medium text-gray-800 hover:text-[#0058be] transition-colors">
                        {member.name}
                      </Link>
                      {positions.map((pos) => (
                        <span key={pos.id} className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" />{pos.title}
                        </span>
                      ))}
                      {canCreate && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                          Creator
                        </span>
                      )}
                    </div>
                    {isAdvisor && (
                      <button onClick={() => toggleEventCreator(member.id)}
                        title={canCreate ? 'Revoke event permission' : 'Grant event creation permission'}
                        className={`text-xs px-2 py-0.5 rounded-lg border transition-colors shrink-0 ${canCreate ? 'text-purple-600 border-purple-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'text-gray-300 border-gray-200 hover:text-purple-600 hover:border-purple-200'}`}>
                        {canCreate ? '−' : '+'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Join Requests — advisor only */}
          {isAdvisor && (
            <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <ClockIcon className="w-3.5 h-3.5" />Join Requests
                </h3>
                {pendingRequests.length > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-[#0058be]">
                    {pendingRequests.length} pending
                  </span>
                )}
              </div>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-gray-400">No pending requests.</p>
              ) : (
                <div className="space-y-0">
                  {isFull && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                      Club is at capacity. Approving will exceed the limit.
                    </p>
                  )}
                  {pendingRequests.map((req) => {
                    const student = getUserById(req.userId)
                    return (
                      <div key={req.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{student?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{formatTime(req.requestedAt)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => handleReject(req.id)}
                            className="text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />Decline
                          </button>
                          <button onClick={() => handleApprove(req.id)}
                            className="text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />Approve
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Club News */}
          {(isMember || isAdvisor) && (
            <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Newspaper className="w-3.5 h-3.5" />Club News
                </h3>
                {canCreateContent && (
                  <button onClick={() => setShowNewsForm((v) => !v)}
                    className="text-xs font-bold text-[#0058be] hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />Post
                  </button>
                )}
              </div>
              {canCreateContent && showNewsForm && (
                <div className="mb-5 p-4 bg-gray-50 rounded-xl space-y-3">
                  <Input value={newNewsTitle} onChange={(e) => setNewNewsTitle(e.target.value)} placeholder="Title…" className="h-8 text-sm" />
                  <textarea value={newNewsContent} onChange={(e) => setNewNewsContent(e.target.value)}
                    placeholder="Write your update…" rows={3}
                    className="w-full bg-white rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-gray-100" />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" checked={newNewsPinned} onChange={(e) => setNewNewsPinned(e.target.checked)} />
                      Pin to top
                    </label>
                    <div className="flex gap-2">
                      <button onClick={postNews} disabled={!newNewsTitle.trim() || !newNewsContent.trim()}
                        className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        Post
                      </button>
                      <button onClick={() => setShowNewsForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              {clubNews.length === 0 ? (
                <p className="text-sm text-gray-400">No news yet.</p>
              ) : (
                <div className="space-y-3">
                  {clubNews.map((news) => {
                    const author = getUserById(news.authorId)
                    return (
                      <div key={news.id} className={`rounded-xl p-4 ${news.isPinned ? 'bg-blue-50/60 border border-blue-100' : 'bg-gray-50'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {news.isPinned && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0058be] mr-2">Pinned</span>
                            )}
                            <span className="font-semibold text-sm text-gray-900">{news.title}</span>
                          </div>
                          {(isAdvisor || news.authorId === currentUser.id) && (
                            <button onClick={() => deleteNews(news.id)} className="text-gray-300 hover:text-red-400 shrink-0 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{news.content}</p>
                        <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-widest">
                          {author?.name} · {formatTime(news.createdAt)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Club Elections */}
          {(isMember || isAdvisor) && (
            <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Vote className="w-3.5 h-3.5" />Elections
                </h3>
                {isAdvisor && (
                  <button onClick={() => setShowPollForm((v) => !v)}
                    className="text-xs font-bold text-[#0058be] hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />New election
                  </button>
                )}
              </div>
              {isAdvisor && showPollForm && (
                <div className="mb-5 p-4 bg-gray-50 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Election Poll</p>
                  <Input value={pollPositionTitle} onChange={(e) => setPollPositionTitle(e.target.value)} placeholder="Position title…" className="h-8 text-sm" />
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Candidates (select 2+)</p>
                    {members.map((m) => m && (
                      <label key={m.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-1.5">
                        <input type="checkbox" checked={pollCandidateIds.includes(m.id)} onChange={() => togglePollCandidate(m.id)} />
                        {m.name}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createPoll} disabled={!pollPositionTitle.trim() || pollCandidateIds.length < 2}
                      className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      Start Election
                    </button>
                    <button onClick={() => setShowPollForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                </div>
              )}
              {clubPolls.length === 0 ? (
                <p className="text-sm text-gray-400">No elections yet.</p>
              ) : (
                <div className="space-y-4">
                  {clubPolls.map((poll) => {
                    const totalVotes = poll.candidates.reduce((s, c) => s + c.votes.length, 0)
                    const alreadyVoted = poll.candidates.some((c) => c.votes.includes(currentUser.id))
                    const winner = !poll.isOpen ? poll.candidates.reduce((a, b) => a.votes.length >= b.votes.length ? a : b) : null
                    return (
                      <div key={poll.id} className={`rounded-xl p-4 border border-gray-100 bg-gray-50 ${!poll.isOpen ? 'opacity-70' : ''}`}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-semibold text-sm text-gray-900" style={{ fontFamily: 'var(--font-manrope)' }}>
                            {poll.positionTitle} Election
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${poll.isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                              {poll.isOpen ? 'Open' : 'Closed'}
                            </span>
                            {isAdvisor && poll.isOpen && (
                              <>
                                <button onClick={() => appointPollWinner(poll.id)} className="text-xs font-medium text-[#0058be] hover:underline">Close & appoint</button>
                                <button onClick={() => closePoll(poll.id)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
                              </>
                            )}
                          </div>
                        </div>
                        {winner && (
                          <p className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-3">
                            Winner: {getUserById(winner.userId)?.name}
                          </p>
                        )}
                        <div className="space-y-2.5">
                          {poll.candidates.map((candidate) => {
                            const user = getUserById(candidate.userId)
                            const pct = totalVotes > 0 ? Math.round((candidate.votes.length / totalVotes) * 100) : 0
                            const hasVotedThis = candidate.votes.includes(currentUser.id)
                            return (
                              <div key={candidate.userId}>
                                <div className="flex items-center gap-3 mb-1">
                                  {poll.isOpen && isMember && !isAdvisor && !alreadyVoted ? (
                                    <button onClick={() => castVote(poll.id, candidate.userId)}
                                      className="w-4 h-4 rounded-full border-2 border-[#0058be] shrink-0 hover:bg-blue-50 transition-colors" />
                                  ) : (
                                    <span className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[10px] ${hasVotedThis ? 'bg-[#0058be] text-white' : 'border border-gray-300'}`}>
                                      {hasVotedThis ? '✓' : ''}
                                    </span>
                                  )}
                                  <div className="flex-1 flex items-center justify-between">
                                    <span className="text-sm text-gray-700">{user?.name}</span>
                                    <span className="text-xs text-gray-400">{candidate.votes.length} vote{candidate.votes.length !== 1 ? 's' : ''}{totalVotes > 0 ? ` · ${pct}%` : ''}</span>
                                  </div>
                                </div>
                                <div className="ml-7 w-full bg-gray-200 rounded-full h-1">
                                  <div className="bg-[#0058be] h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {poll.isOpen && isMember && !isAdvisor && (
                          <p className="text-xs text-gray-400 mt-3">{alreadyVoted ? 'You have voted.' : 'Select a candidate to cast your vote.'}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Events */}
          <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />Events
              </h3>
              {canCreateContent && (
                <button onClick={() => setShowEventForm((v) => !v)}
                  className="text-xs font-bold text-[#0058be] hover:underline flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />Add event
                </button>
              )}
            </div>
            {canCreateContent && showEventForm && (
              <div className="mb-5 p-4 bg-gray-50 rounded-xl space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Event</p>
                <Input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="Event title…" className="h-8 text-sm" />
                <textarea value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="Description…" rows={2}
                  className="w-full bg-white rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-gray-100" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date</label>
                    <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Location</label>
                    <Input value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} placeholder="Room 204…" className="h-8 text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={newEventPublic} onChange={(e) => setNewEventPublic(e.target.checked)} />
                  Public event (visible on Events page)
                </label>
                <div className="flex gap-2">
                  <button onClick={createEvent} disabled={!newEventTitle.trim() || !newEventDate}
                    className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Create Event
                  </button>
                  <button onClick={() => setShowEventForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            )}
            {clubEvents.length === 0 ? (
              <p className="text-sm text-gray-400">No events yet.</p>
            ) : (
              <div className="space-y-3">
                {clubEvents.map((event) => {
                  const creator = getUserById(event.createdBy)
                  const canDelete = isAdvisor || event.createdBy === currentUser.id
                  const date = new Date(event.date + 'T00:00:00')
                  return (
                    <div key={event.id} className="flex gap-4 p-4 bg-gray-50 rounded-xl group">
                      <div className="w-12 shrink-0 text-center bg-white rounded-lg py-2 shadow-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{date.toLocaleString('en', { month: 'short' })}</p>
                        <p className="text-xl font-black text-gray-900 leading-none" style={{ fontFamily: 'var(--font-manrope)' }}>{date.getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{event.title}</p>
                            {!event.isPublic && (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">Members only</span>
                            )}
                          </div>
                          {canDelete && (
                            <button onClick={() => deleteEvent(event.id)} className="text-gray-300 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {event.description && <p className="text-xs text-gray-500 mt-1">{event.description}</p>}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {event.location && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <MapPin className="w-3 h-3" />{event.location}
                            </span>
                          )}
                          {creator && <span className="text-xs text-gray-400">by {creator.name}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">

          {/* My Attendance — student members only */}
          {isMember && !isAdvisor && currentUser.role === 'student' && (
            <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-4">
                <CheckCircle className="w-3.5 h-3.5" />My Attendance
              </h3>
              {myAttendance.length === 0 ? (
                <p className="text-sm text-gray-400">No records yet.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{myPresent}/{myAttendance.length} sessions</span>
                    <span className="text-sm font-bold text-gray-800">{Math.round((myPresent / myAttendance.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                    <div className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.round((myPresent / myAttendance.length) * 100)}%`,
                        background: myPresent / myAttendance.length >= 0.8 ? '#10b981' : myPresent / myAttendance.length >= 0.5 ? '#f59e0b' : '#ef4444',
                      }} />
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {[...myAttendance].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)).map((rec) => (
                      <div key={rec.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{rec.meetingDate}</span>
                        <span className={`font-bold ${rec.present ? 'text-emerald-600' : 'text-red-400'}`}>
                          {rec.present ? 'Present' : 'Absent'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* All Attendance — advisor only */}
          {isAdvisor && (
            <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />Attendance
                </h3>
                <div className="flex gap-1.5">
                  <button onClick={() => { setShowManual((v) => !v); setShowQrForm(false); setActiveSession(null) }}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1 transition-colors">
                    Manual
                  </button>
                  <button onClick={() => { setShowQrForm((v) => !v); setShowManual(false); setActiveSession(null) }}
                    className="text-xs font-bold text-[#0058be] border border-blue-200 hover:bg-blue-50 rounded-lg px-2.5 py-1 flex items-center gap-1 transition-colors">
                    <QrCode className="w-3 h-3" />QR
                  </button>
                </div>
              </div>

              {showQrForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Generate Check-in QR</p>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Meeting date</label>
                    <Input type="date" value={qrDate} onChange={(e) => setQrDate(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Expires after</label>
                    <select value={qrExpiry} onChange={(e) => setQrExpiry(Number(e.target.value))}
                      className="w-full bg-white rounded-lg px-2 py-1.5 text-xs border border-gray-200 focus:outline-none">
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Max distance (m, 0 = disabled)</label>
                    <Input type="number" min={0} value={qrDistance} onChange={(e) => setQrDistance(Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={qrCaptureLocation} onChange={(e) => setQrCaptureLocation(e.target.checked)} />
                    Capture my location now
                  </label>
                  <button onClick={generateQr} className="w-full text-sm font-bold bg-[#0058be] text-white rounded-xl py-2.5 hover:bg-blue-700 transition-colors">
                    Generate
                  </button>
                </div>
              )}

              {activeSession && (
                <div className="mb-4 p-4 bg-blue-50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700">{activeSession.meetingDate} check-in</p>
                    <button onClick={() => setActiveSession(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getAttendUrl(activeSession))}`}
                      alt="Attendance QR code" className="rounded-xl border-4 border-white shadow-sm" width={180} height={180} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input readOnly value={getAttendUrl(activeSession)}
                      className="flex-1 text-xs rounded-lg px-2 py-1.5 bg-white border border-gray-100 text-gray-600 font-mono truncate" />
                    <button onClick={() => copyLink(activeSession)}
                      className="shrink-0 text-[#0058be] flex items-center gap-1 text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white hover:bg-blue-50 transition-colors">
                      <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Expires {new Date(activeSession.expiresAt).toLocaleTimeString()}
                    {activeSession.maxDistanceMeters > 0 && ` · Within ${activeSession.maxDistanceMeters}m`}
                  </p>
                </div>
              )}

              {showManual && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Manual Attendance</p>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Date</label>
                    <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="h-8 text-xs" />
                  </div>
                  {members.length === 0 ? (
                    <p className="text-xs text-gray-400">No members yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {members.map((member) => {
                        if (!member) return null
                        const rec = attendanceRecords.find((r) => r.userId === member.id && r.meetingDate === manualDate)
                        const isPresent = rec?.present
                        return (
                          <div key={member.id} className="flex items-center justify-between py-1">
                            <span className="text-sm text-gray-700">{member.name}</span>
                            <div className="flex gap-1">
                              <button onClick={() => setManualAttendance(member.id, true)}
                                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${isPresent === true ? 'bg-emerald-500 text-white border-emerald-500' : 'text-gray-400 border-gray-200 hover:border-emerald-400 hover:text-emerald-600'}`}>
                                Present
                              </button>
                              <button onClick={() => setManualAttendance(member.id, false)}
                                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${isPresent === false ? 'bg-red-400 text-white border-red-400' : 'text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-500'}`}>
                                Absent
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {memberAttendance.length === 0 ? (
                <p className="text-sm text-gray-400">No members yet.</p>
              ) : (
                <div className="space-y-3">
                  {memberAttendance.map(({ user, total, present }) => {
                    if (!user) return null
                    const pct = total > 0 ? Math.round((present / total) * 100) : null
                    return (
                      <div key={user.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">{user.name}</span>
                          <span className="text-xs text-gray-400">{total === 0 ? 'No records' : `${present}/${total}`}</span>
                        </div>
                        {pct !== null && (
                          <>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{pct}%</p>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Leadership */}
          <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-4">
              <Crown className="w-3.5 h-3.5 text-amber-500" />Leadership
            </h3>
            <div className="space-y-4">
              {club.leadershipPositions.map((pos) => {
                const holder = pos.userId ? getUserById(pos.userId) : null
                return (
                  <div key={pos.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{pos.title}</span>
                      {isAdvisor && (
                        <button onClick={() => removePosition(pos.id)} className="text-gray-200 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-1.5">
                      {holder ? holder.name : <span className="text-gray-400 font-normal italic">Vacant</span>}
                    </p>
                    {isAdvisor && (
                      <div className="flex items-center gap-1.5">
                        <select value={appointSelections[pos.id] ?? ''} onChange={(e) => setAppointSelections((prev) => ({ ...prev, [pos.id]: e.target.value }))}
                          className="text-xs bg-gray-50 rounded-lg px-2 py-1 border-none focus:outline-none flex-1 min-w-0 text-gray-600">
                          <option value="">Select member…</option>
                          {members.map((m) => m && <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button onClick={() => appointMember(pos.id)} disabled={!appointSelections[pos.id]}
                          className="text-xs font-bold bg-[#0058be] text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0 transition-colors">
                          <UserCheck className="w-3 h-3" />Appoint
                        </button>
                        {holder && (
                          <button onClick={() => removeAppointment(pos.id)} className="text-gray-300 hover:text-red-400 shrink-0 transition-colors">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {isAdvisor && (
                <div className="pt-3 border-t border-gray-50 flex items-center gap-1.5">
                  <Input value={newPositionTitle} onChange={(e) => setNewPositionTitle(e.target.value)}
                    placeholder="New position title…" className="h-8 text-xs flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addPosition()} />
                  <button onClick={addPosition} disabled={!newPositionTitle.trim()}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border bg-white text-gray-400 hover:text-[#0058be] hover:border-blue-300 disabled:opacity-40 transition-colors shrink-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Meeting Times */}
          <div className="bg-white rounded-xl p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-4">
              <Clock className="w-3.5 h-3.5" />Meeting Times
            </h3>
            {club.meetingTimes.length === 0 && !isAdvisor && (
              <p className="text-sm text-gray-400">No meeting times set.</p>
            )}
            <div className="space-y-2.5 mb-3">
              {club.meetingTimes.map((mt) => (
                <div key={mt.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{DAY_NAMES[mt.dayOfWeek]}s · {mt.startTime}–{mt.endTime}</p>
                    {mt.location && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{mt.location}
                      </p>
                    )}
                  </div>
                  {isAdvisor && (
                    <button onClick={() => removeMeetingTime(mt.id)} className="text-gray-300 hover:text-red-400 ml-2 shrink-0 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdvisor && (
              <div className="pt-3 border-t border-gray-50 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Add meeting time</p>
                <select value={newMeetingDay} onChange={(e) => setNewMeetingDay(Number(e.target.value))}
                  className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2 border-none focus:outline-none text-gray-700">
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}s</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Start</label>
                    <Input type="time" value={newMeetingStart} onChange={(e) => setNewMeetingStart(e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">End</label>
                    <Input type="time" value={newMeetingEnd} onChange={(e) => setNewMeetingEnd(e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
                <Input value={newMeetingLocation} onChange={(e) => setNewMeetingLocation(e.target.value)}
                  placeholder="Location (optional)" className="h-7 text-xs" />
                <button onClick={addMeetingTime}
                  className="w-full text-sm font-bold bg-gray-100 text-gray-700 rounded-xl py-2 hover:bg-gray-200 transition-colors">
                  Add
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
