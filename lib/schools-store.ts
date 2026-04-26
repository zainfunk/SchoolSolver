import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { School } from '@/types'

// ── Invite code generation ────────────────────────────────────────────────────
//
// All token generators below use Node's CSPRNG (crypto.randomBytes /
// randomInt), NOT Math.random. Math.random in V8 is xorshift128+ —
// non-cryptographic and trivially reverse-engineerable from a small
// number of observed outputs. See: docs/security/ClubIt-Security-Assessment.md
// finding C-7.

// Confusion-free uppercase alphabet: 32 chars (2^5), no 0/O/1/I/L which
// students miscopy. 8 random chars => 32^8 = ~1.1e12 = 40 bits of entropy.
// /api/join is rate-limited (5/60s per user); brute-forcing one code at
// that rate takes roughly 200,000 years on average. Admin and advisor
// codes can be rotated by a superadmin if a leak is suspected.
const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

function randomToken(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += SAFE_ALPHABET[randomInt(0, SAFE_ALPHABET.length)]
  }
  return out
}

export function generateInviteCode(prefix: 'STU' | 'ADM' | 'ADV'): string {
  // Format: <PFX>-<8 chars>, e.g. STU-A2B4C6D8 — 12 characters total,
  // shorter than the previous 26-char base64url codes so students can
  // hand-type without errors.
  return `${prefix}-${randomToken(8)}`
}

export function generateSetupToken(): string {
  // 32 bytes -> 43 base64url chars -> 256 bits of entropy. Far above the
  // assessment's >= 128-bit requirement.
  return randomBytes(32).toString('base64url')
}

// Setup tokens expire after 7 days
export function setupTokenExpiresAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString()
}

/**
 * Domain-prefixed UUID for record IDs (clubs, events, news, etc).
 * Use this anywhere you used to write `${prefix}-${Date.now()}-${Math.random()...}`.
 */
export function generateRecordId(prefix: string): string {
  return `${prefix}-${randomUUID()}`
}

// ── Row mappers ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToSchool(row: Record<string, any>): School {
  return {
    id: row.id,
    name: row.name,
    district: row.district ?? undefined,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    status: row.status,
    studentInviteCode: row.student_invite_code ?? undefined,
    adminInviteCode: row.admin_invite_code ?? undefined,
    advisorInviteCode: row.advisor_invite_code ?? undefined,
    setupToken: row.setup_token ?? undefined,
    setupTokenExpiresAt: row.setup_token_expires_at ?? undefined,
    setupCompletedAt: row.setup_completed_at ?? undefined,
    createdAt: row.created_at,
  }
}
