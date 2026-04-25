/**
 * W1.5 — verify the unsupported marketing claims flagged in the assessment
 * are not present anywhere in the shipped UI or docs.
 *
 * The original copy at components/landing/LandingPage.tsx claimed:
 *   "encrypted end-to-end" — false; chat_messages are stored in plaintext.
 *   "FERPA-compliant"      — unverifiable; FERPA compliance requires a
 *                            written agreement and audit logs the system
 *                            does not have.
 *   "SOC 2 in progress"    — unverifiable.
 *
 * This test fails the build if any user-facing source file (app/,
 * components/, public/) contains these literals. Backend and security
 * docs are allowed to mention them as historical context.
 *
 * Closes finding W1.5 from docs/security/ClubIt-Security-Assessment.md.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// User-facing surfaces only.
const SCAN_DIRS = ['app', 'components', 'public']

const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'end-to-end encrypted',  re: /\bend[\s-]to[\s-]end\b/i },
  { name: 'E2EE',                  re: /\bE2EE\b/ },
  { name: 'FERPA-compliant',       re: /\bFERPA[-\s]compliant\b/i },
  { name: 'SOC 2 in progress',     re: /\bSOC[-\s]?2\s+in\s+progress\b/i },
  { name: 'SOC 2 certified',       re: /\bSOC[-\s]?2\s+certified\b/i },
]

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.html', '.md',
])

function* walk(dir: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) yield* walk(full)
    else if (st.isFile()) yield full
  }
}

describe('W1.5: no unsupported marketing claims in user-facing surfaces', () => {
  it('no app/, components/, or public/ file contains the forbidden phrases', () => {
    const violations: { file: string; phrase: string }[] = []

    for (const scanDir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, scanDir))) {
        const dot = file.lastIndexOf('.')
        const ext = dot === -1 ? '' : file.slice(dot)
        if (!TEXT_EXTENSIONS.has(ext)) continue

        let content: string
        try { content = readFileSync(file, 'utf8') } catch { continue }

        for (const { name, re } of FORBIDDEN) {
          if (re.test(content)) {
            violations.push({ file: relative(ROOT, file).replace(/\\/g, '/'), phrase: name })
          }
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v.file}: ${v.phrase}`).join('\n')
      throw new Error(`Found ${violations.length} unsupported claim(s):\n${msg}`)
    }
    expect(violations).toEqual([])
  })
})
