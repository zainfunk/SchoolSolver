'use client'

import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { USERS } from '@/lib/mock-data'
import { getOverride, setName, setEmail, applyOverrides } from '@/lib/user-store'
import Avatar from '@/components/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pencil, Check, X, Shield } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-red-100 text-red-700 border-red-200',
  advisor: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-green-100 text-green-700 border-green-200',
}

export default function ProfilePage() {
  const { currentUser, setCurrentUser } = useMockAuth()

  // Editable own profile fields
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  // Admin: editing another user's name
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // Merge stored overrides into display data
  const [displayUsers, setDisplayUsers] = useState(() => USERS.map(applyOverrides))

  function refresh() {
    setDisplayUsers(USERS.map(applyOverrides))
  }

  const isAdmin = currentUser.role === 'admin'
  const profileUser = isAdmin
    ? displayUsers.find((u) => u.id === selectedUserId) ?? displayUsers[0]
    : displayUsers.find((u) => u.id === currentUser.id)!

  function saveEmail() {
    if (!emailInput.trim()) return
    setEmail(currentUser.id, emailInput.trim())
    refresh()
    // Update mock auth context display name if viewing own profile
    setCurrentUser({ ...currentUser, email: emailInput.trim() })
    setEditingEmail(false)
  }

  function saveName() {
    if (!nameInput.trim()) return
    setName(profileUser.id, nameInput.trim())
    refresh()
    // If editing own name as admin, update context too
    if (profileUser.id === currentUser.id) {
      setCurrentUser({ ...currentUser, name: nameInput.trim() })
    }
    setEditingName(false)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* Admin: user selector */}
      {isAdmin && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500" />
              Admin — Edit Any User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={selectedUserId}
              onChange={(e) => { setSelectedUserId(e.target.value); setEditingName(false); setEditingEmail(false) }}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {displayUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {/* Profile card */}
      <Card>
        <CardContent className="pt-6">
          {/* Avatar + name */}
          <div className="flex items-center gap-5 mb-6">
            <Avatar name={profileUser.name} size="lg" />
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  />
                  <button onClick={saveName} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{profileUser.name}</h2>
                  {isAdmin && (
                    <button
                      onClick={() => { setNameInput(profileUser.name); setEditingName(true) }}
                      className="text-gray-400 hover:text-gray-600"
                      title="Edit name (admin only)"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <Badge className={`text-xs mt-1 border ${ROLE_COLORS[profileUser.role]}`}>
                {profileUser.role}
              </Badge>
              {!isAdmin && profileUser.id === currentUser.id && (
                <p className="text-xs text-gray-400 mt-1">Name can only be changed by an admin.</p>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Email</label>
              {(editingEmail && profileUser.id === currentUser.id) || (isAdmin && editingEmail) ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEmail()}
                  />
                  <button onClick={saveEmail} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingEmail(false)} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-800">{profileUser.email}</p>
                  {/* Anyone can edit their own email; admin can edit any */}
                  {(profileUser.id === currentUser.id || isAdmin) && (
                    <button
                      onClick={() => { setEmailInput(profileUser.email); setEditingEmail(true) }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* User ID (read-only) */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">User ID</label>
              <p className="text-sm text-gray-400 font-mono">{profileUser.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
