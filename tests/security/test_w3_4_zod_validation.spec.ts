/**
 * W3.4 / H-10 — verify zod schemas reject:
 *  - mass-assignment (extra fields)
 *  - javascript: / data: / vbscript: URLs in `socials[].url`
 *  - missing required fields
 *  - oversize fields (e.g. 50KB bio)
 *
 * Closes finding W3.4 / H-10.
 */
import { describe, it, expect } from 'vitest'
import {
  ProfilePatchSchema,
  SocialLinkSchema,
  OnboardSchema,
  JoinSchema,
  UserOverridesSchema,
  PrivacyPatchSchema,
  SafeUrl,
} from '@/lib/schemas'

describe('W3.4: SafeUrl rejects non-http(s) protocols', () => {
  for (const bad of [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'about:blank',
    '   javascript:alert(1)',  // leading whitespace bypass attempt
  ]) {
    it(`rejects: ${bad}`, () => {
      const r = SafeUrl.safeParse(bad)
      expect(r.success).toBe(false)
    })
  }
  for (const good of [
    'http://example.com',
    'https://example.com/path?q=1',
    'https://sub.domain.example.com:443/',
  ]) {
    it(`accepts: ${good}`, () => {
      const r = SafeUrl.safeParse(good)
      expect(r.success).toBe(true)
    })
  }
})

describe('W3.4 / H-10: ProfilePatchSchema socials enforcement', () => {
  it('rejects javascript: URL in socials[].url', () => {
    const r = ProfilePatchSchema.safeParse({
      socials: [{ platform: 'website', url: 'javascript:alert(1)' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects unknown extra fields (mass-assignment)', () => {
    const r = ProfilePatchSchema.safeParse({
      bio: 'hi',
      role: 'admin',          // <-- attempted privilege escalation
      school_id: 'attacker-school-id',
    } as object)
    expect(r.success).toBe(false)
  })

  it('rejects bio over 4000 chars', () => {
    const r = ProfilePatchSchema.safeParse({ bio: 'a'.repeat(4001) })
    expect(r.success).toBe(false)
  })

  it('rejects more than 20 socials', () => {
    const socials = Array.from({ length: 21 }, () => ({
      platform: 'website' as const,
      url: 'https://example.com',
    }))
    const r = ProfilePatchSchema.safeParse({ socials })
    expect(r.success).toBe(false)
  })

  it('accepts a valid profile patch', () => {
    const r = ProfilePatchSchema.safeParse({
      bio: 'About me',
      skills: ['robotics', 'ml'],
      socials: [{ platform: 'instagram', url: 'https://instagram.com/me' }],
    })
    expect(r.success).toBe(true)
  })

  it('SocialLinkSchema rejects unknown platform', () => {
    const r = SocialLinkSchema.safeParse({
      platform: 'tiktok',
      url: 'https://tiktok.com/@me',
    })
    expect(r.success).toBe(false)
  })
})

describe('W3.4: OnboardSchema', () => {
  it('rejects missing contactEmail', () => {
    expect(OnboardSchema.safeParse({ name: 'X', contactName: 'Y' }).success).toBe(false)
  })
  it('rejects bad email', () => {
    expect(OnboardSchema.safeParse({
      name: 'X', contactName: 'Y', contactEmail: 'not-an-email',
    }).success).toBe(false)
  })
  it('rejects extra fields', () => {
    const r = OnboardSchema.safeParse({
      name: 'X', contactName: 'Y', contactEmail: 'a@b.test',
      requested_admin_user_id: 'attacker',  // mass-assignment attempt
    } as object)
    expect(r.success).toBe(false)
  })
  it('accepts a valid payload', () => {
    expect(OnboardSchema.safeParse({
      name: 'Oakridge HS', district: 'Oakridge USD',
      contactName: 'Principal Hayes', contactEmail: 'principal@oakridge.edu',
    }).success).toBe(true)
  })
})

describe('W3.4: JoinSchema', () => {
  it('rejects missing code', () => {
    expect(JoinSchema.safeParse({}).success).toBe(false)
  })
  it('rejects empty code', () => {
    expect(JoinSchema.safeParse({ code: '' }).success).toBe(false)
  })
  it('rejects code longer than 64 chars', () => {
    expect(JoinSchema.safeParse({ code: 'A'.repeat(65) }).success).toBe(false)
  })
  it('accepts a valid code', () => {
    expect(JoinSchema.safeParse({ code: 'STU-aBcDeFgHiJkLmNoPqRsTuV' }).success).toBe(true)
  })
})

describe('W3.4: UserOverridesSchema', () => {
  it('requires at least one of name / email', () => {
    expect(UserOverridesSchema.safeParse({}).success).toBe(false)
  })
  it('rejects bad email', () => {
    expect(UserOverridesSchema.safeParse({ email: 'nope' }).success).toBe(false)
  })
  it('accepts name-only', () => {
    expect(UserOverridesSchema.safeParse({ name: 'Alex' }).success).toBe(true)
  })
})

describe('W3.4: PrivacyPatchSchema', () => {
  it('requires at least one boolean', () => {
    expect(PrivacyPatchSchema.safeParse({}).success).toBe(false)
  })
  it('rejects non-boolean values', () => {
    expect(PrivacyPatchSchema.safeParse({ achievementsPublic: 'yes' } as object).success).toBe(false)
  })
  it('accepts a single toggle', () => {
    expect(PrivacyPatchSchema.safeParse({ achievementsPublic: false }).success).toBe(true)
  })
})
