import { randomBytes, randomUUID } from 'node:crypto'
import { School } from '@/types'

// ── Invite code generation ────────────────────────────────────────────────────
//
// All token generators below use Node's CSPRNG (crypto.randomBytes), NOT
// Math.random. Math.random in V8 is xorshift128+ — non-cryptographic and
// trivially reverse-engineerable from a small number of observed outputs.
// See: docs/security/ClubIt-Security-Assessment.md finding C-7.

export function generateInviteCode(prefix: 'STU' | 'ADM' | 'ADV'): string {
  // 16 bytes -> 22 base64url chars -> 128 bits of entropy. Meets the
  // assessment §9 item 3 requirement (>=64 bits, ideally not derived from
  // a predictable PRNG). Format: <PFX>-<22 base64url chars>, e.g.
  //   STU-aBcDeFgH1jKlMnOpQrStUv
  // Three-letter prefix is preserved so admins can recognize a code's
  // role at a glance; everything after the dash is opaque.
  return `${prefix}-${randomBytes(16).toString('base64url')}`
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
