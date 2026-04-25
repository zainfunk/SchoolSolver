/**
 * W1.1 — verify no committable file in the working tree contains a literal
 * secret pattern.
 *
 * This catches the class of leak that was found at
 * `tests/e2e/create-accounts.spec.ts:18` (commit 675af6f) where a Clerk
 * Backend API key was hardcoded as a constant.
 *
 * Files matched by `.gitignore` (e.g. `.env.local`) are skipped because by
 * definition they cannot be committed. The pattern intentionally requires
 * the *full* shape of a real secret (a realistic-length suffix), so test
 * code that greps for the bare prefix "sk_test_" doesn't false-positive.
 *
 * Closes finding W1.1 from docs/security/ClubIt-Security-Assessment.md.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = join(__dirname, '..', '..')

// Skip these — they're not part of the source tree we ship.
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', '.husky', 'test-results',
  'screenshots', '.auth', '.chrome-data',
])

// Allowlist: files where occurrences are intentional context (e.g. the
// security assessment documents the historical leak as evidence). New
// entries here require a written justification in the commit message.
const ALLOWLIST = new Set([
  'tests/security/test_w1_1_no_secrets_in_tree.spec.ts',
  'docs/security/ClubIt-Security-Assessment.md',
  '.husky/pre-commit',
])

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.md', '.sql', '.sh',
  '.html', '.css',
])

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'Clerk/Stripe sk_test_', re: /\bsk_test_[A-Za-z0-9]{20,}/ },
  { name: 'Clerk/Stripe sk_live_', re: /\bsk_live_[A-Za-z0-9]{20,}/ },
  { name: 'Stripe whsec_',         re: /\bwhsec_[A-Za-z0-9]{20,}/ },
  // JWT shape: three base64url segments separated by dots, each >=20 chars.
  { name: 'JWT (Supabase/Clerk)',  re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Long pk_ key',          re: /\b(pk_test_|pk_live_)[A-Za-z0-9]{40,}/ },
]

function isGitIgnored(absolutePath: string): boolean {
  // `git check-ignore -q <path>` exits 0 if the path is ignored, 1 if not.
  // Any other exit (e.g. not a git repo) means we err on the side of "scan it."
  try {
    execFileSync('git', ['check-ignore', '-q', absolutePath], {
      stdio: 'ignore',
      cwd: ROOT,
    })
    return true
  } catch {
    return false
  }
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      yield* walk(full)
    } else if (st.isFile()) {
      yield full
    }
  }
}

describe('W1.1: no secret patterns in working tree', () => {
  it('no committable file contains a fully-formed secret', () => {
    const violations: { file: string; pattern: string; sample: string }[] = []

    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')

      if (ALLOWLIST.has(rel)) continue
      if (isGitIgnored(file)) continue

      const dot = file.lastIndexOf('.')
      const ext = dot === -1 ? '' : file.slice(dot)
      if (!TEXT_EXTENSIONS.has(ext)) continue

      let content: string
      try {
        content = readFileSync(file, 'utf8')
      } catch {
        continue
      }

      for (const { name, re } of SECRET_PATTERNS) {
        const match = content.match(re)
        if (match) {
          violations.push({
            file: rel,
            pattern: name,
            sample: match[0].slice(0, 12) + '…',
          })
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}: ${v.pattern} (${v.sample})`)
        .join('\n')
      throw new Error(`Found ${violations.length} secret leak(s):\n${msg}`)
    }
    expect(violations).toEqual([])
  })
})
