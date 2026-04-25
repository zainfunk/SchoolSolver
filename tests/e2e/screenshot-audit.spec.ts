import { test, Page } from '@playwright/test'
import * as fs from 'fs'

const BASE = 'http://localhost:3000'
const CLERK_SECRET = process.env.CLERK_SECRET_KEY
if (!CLERK_SECRET) {
  throw new Error('CLERK_SECRET_KEY is not set. Add it to .env.local or your shell env before running this spec.')
}

const SCHOOL = {
  id: 'b6d8f06e-5b3c-45ea-a799-cfaba8283d91',
  name: 'Shelton',
  status: 'active',
}

const ACCOUNTS = {
  student: { clerkId: 'user_3CHbN64PDvOusZFkX2JPbVU922B', role: 'student' },
  admin: { clerkId: 'user_3CHbdjUGEcCUhf4Je7ObHfQybPD', role: 'admin' },
}

async function getSignInTicket(userId: string): Promise<string> {
  const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLERK_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  const body = (await res.json()) as any
  return new URL(body.url).searchParams.get('__clerk_ticket')!
}

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  const ticket = await getSignInTicket(account.clerkId)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${ticket}`)
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
  await page.evaluate(
    ({ clerkId, role, school }) => {
      localStorage.setItem(`clubit_school_${clerkId}`, JSON.stringify({
        schoolId: school.id, schoolName: school.name, role, schoolStatus: school.status,
      }))
    },
    { clerkId: account.clerkId, role: account.role, school: SCHOOL }
  )
}

const OUT = 'test-results/screenshots'

async function snap(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)
  // Viewport-only screenshot (what the user actually sees)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
  // Full page screenshot for scrollable content
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true })
}

test('Screenshot all pages', async ({ page }) => {
  test.setTimeout(600_000)
  fs.mkdirSync(OUT, { recursive: true })

  // ── Student pages ──
  await signInAs(page, ACCOUNTS.student)

  await page.goto(`${BASE}/dashboard`); await snap(page, '01-student-dashboard')
  await page.goto(`${BASE}/clubs`); await snap(page, '02-student-clubs')
  await page.goto(`${BASE}/events`); await snap(page, '03-student-events')
  await page.goto(`${BASE}/chat`); await snap(page, '04-student-chat')
  await page.goto(`${BASE}/elections`); await snap(page, '05-student-elections')
  await page.goto(`${BASE}/profile`); await snap(page, '06-student-profile')
  await page.goto(`${BASE}/settings`); await snap(page, '07-student-settings')

  // ── Admin pages ──
  await signInAs(page, ACCOUNTS.admin)

  await page.goto(`${BASE}/admin`); await snap(page, '08-admin-panel')
  await page.goto(`${BASE}/admin/billing`); await snap(page, '09-admin-billing')
  await page.goto(`${BASE}/clubs`); await snap(page, '10-admin-clubs')
  await page.goto(`${BASE}/chat`); await snap(page, '11-admin-chat')
  await page.goto(`${BASE}/profile`); await snap(page, '12-admin-profile')
  await page.goto(`${BASE}/settings`); await snap(page, '13-admin-settings')
  await page.goto(`${BASE}/join`); await snap(page, '14-join-page')

  // ── Public pages ──
  await page.goto(`${BASE}/landing`); await snap(page, '15-landing')

  console.log(`Screenshots saved to ${OUT}/`)
})
