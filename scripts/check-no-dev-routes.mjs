#!/usr/bin/env node
/**
 * After `next build`, walk the .next/ output and fail if any compiled
 * route lives under a path matching a dev-only namespace. Catches the
 * case where strip-dev-routes.mjs missed a file or a new dev route was
 * added without being added to the strip list.
 *
 * Run by `npm run build:prod` after `next build` completes. CI also runs
 * it as a separate step (.github/workflows/ci.yml — added in W4.3).
 *
 * Closes finding W1.6 follow-up.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const NEXT_DIR = join(ROOT, '.next')

if (!existsSync(NEXT_DIR)) {
  console.error('[check-no-dev-routes] .next/ not found. Run `next build` first.')
  process.exit(2)
}

// Forbidden path fragments (using OS-specific separator on either side).
const FORBIDDEN = [
  ['app', 'dev'],
  ['app', 'api', 'dev'],
  ['app', 'api', 'superadmin', 'invite'],
  ['app', 'api', 'invite'],
]

function* walk(dir) {
  let entries
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

const violations = []
for (const file of walk(NEXT_DIR)) {
  const rel = relative(ROOT, file)
  const segs = rel.split(sep)
  for (const frag of FORBIDDEN) {
    // Look for the fragment as a contiguous subsequence of path segments.
    outer: for (let i = 0; i + frag.length <= segs.length; i++) {
      for (let j = 0; j < frag.length; j++) {
        if (segs[i + j] !== frag[j]) continue outer
      }
      violations.push({ file: rel, fragment: frag.join('/') })
      break
    }
  }
}

if (violations.length > 0) {
  console.error(`[check-no-dev-routes] found ${violations.length} dev-route artifact(s) in .next/:`)
  for (const v of violations.slice(0, 20)) {
    console.error(`  ${v.file}  (matches: ${v.fragment})`)
  }
  if (violations.length > 20) {
    console.error(`  ... and ${violations.length - 20} more`)
  }
  console.error('Either run `node scripts/strip-dev-routes.mjs` before `next build`, or add the')
  console.error('new dev path to scripts/strip-dev-routes.mjs DEV_PATHS.')
  process.exit(1)
}

console.log('[check-no-dev-routes] OK — no dev-route artifacts in .next/.')
