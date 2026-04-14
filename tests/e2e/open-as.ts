/**
 * Opens a browser signed in as a test account using Clerk sign-in tokens.
 * No CAPTCHA, no email verification.
 *
 * Usage:
 *   npx tsx tests/e2e/open-as.ts student
 *   npx tsx tests/e2e/open-as.ts advisor
 *   npx tsx tests/e2e/open-as.ts admin
 */

import { chromium } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const role = process.argv[2] as 'student' | 'advisor' | 'admin'
if (!role || !['student', 'advisor', 'admin'].includes(role)) {
  console.error('Usage: npx tsx tests/e2e/open-as.ts <student|advisor|admin>')
  process.exit(1)
}

const CLERK_SECRET = process.env.CLERK_SECRET_KEY
if (!CLERK_SECRET) {
  console.error('Missing CLERK_SECRET_KEY in .env.local')
  process.exit(1)
}

const ACCOUNTS: Record<string, { email: string }> = {
  student: { email: 'rithmohanty07+1@gmail.com' },
  advisor: { email: 'rithmohanty07+2@gmail.com' },
  admin:   { email: 'rithmohanty07+3@gmail.com' },
}

const BASE = 'http://localhost:3000'

async function clerkApi(endpoint: string, method = 'GET', body?: object) {
  const res = await fetch(`https://api.clerk.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Clerk API ${endpoint} failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function main() {
  const account = ACCOUNTS[role]
  console.log(`\nSigning in as ${role} (${account.email})...`)

  // 1. Look up user by email
  const users = await clerkApi(`/users?email_address=${encodeURIComponent(account.email)}`)
  if (!users.length) {
    console.error(`No Clerk user found for ${account.email}`)
    process.exit(1)
  }
  const userId = users[0].id
  console.log(`Found user: ${userId}`)

  // 2. Create sign-in token
  const token = await clerkApi('/sign_in_tokens', 'POST', { user_id: userId })
  const ticket = token.token
  console.log(`Got sign-in ticket`)

  // 3. Open browser and navigate with ticket
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'] })
  const context = await browser.newContext({ viewport: null })
  const page = await context.newPage()

  const signInUrl = `${BASE}/sign-in?__clerk_ticket=${ticket}`
  console.log(`Opening browser...`)
  await page.goto(signInUrl)

  // Wait for auth to process and redirect
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {
    console.log('Did not auto-redirect to dashboard — browser is open for you to use.')
  })

  console.log(`\n✓ Browser open as ${role}. Close the browser window when done.\n`)

  // Keep alive until browser closes
  await new Promise<void>((resolve) => {
    browser.on('disconnected', () => resolve())
  })
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
