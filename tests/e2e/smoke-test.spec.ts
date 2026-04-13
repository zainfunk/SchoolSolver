import { test, expect, Page } from '@playwright/test'

/*
 * SMOKE TEST — Verifies all major pages and features for each role.
 *
 * Prerequisites: Run create-accounts.spec.ts first.
 *
 * Run:
 *   npx playwright test tests/e2e/smoke-test.spec.ts --headed --workers=1
 */

const BASE = 'http://localhost:3000'
const CLERK_SECRET = '***REMOVED-CLERK-SECRET***'

// School info (from Supabase)
const SCHOOL = {
  id: 'b6d8f06e-5b3c-45ea-a799-cfaba8283d91',
  name: 'Shelton',
  status: 'active',
}

const ACCOUNTS = {
  student: {
    email: 'rithmohanty07+1@gmail.com',
    clerkId: 'user_3CHbN64PDvOusZFkX2JPbVU922B',
    role: 'student',
  },
  advisor: {
    email: 'rithmohanty07+2@gmail.com',
    clerkId: 'user_3CHbbnP13LUdb8mMrNua5m5yAkO',
    role: 'advisor',
  },
  admin: {
    email: 'rithmohanty07+3@gmail.com',
    clerkId: 'user_3CHbdjUGEcCUhf4Je7ObHfQybPD',
    role: 'admin',
  },
}

// ── Helpers ──

async function getSignInTicket(userId: string): Promise<string> {
  const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  })
  const body = await res.json() as any
  if (!res.ok) throw new Error(`Sign-in token failed: ${JSON.stringify(body)}`)
  return new URL(body.url).searchParams.get('__clerk_ticket')!
}

async function signInAs(page: Page, account: typeof ACCOUNTS.student) {
  const ticket = await getSignInTicket(account.clerkId)

  // Sign in via ticket
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${ticket}`)
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })

  // Pre-set localStorage so MockAuthProvider has school context immediately
  await page.evaluate(({ clerkId, role, school }) => {
    const session = {
      schoolId: school.id,
      schoolName: school.name,
      role: role,
      schoolStatus: school.status,
    }
    localStorage.setItem(`clubit_school_${clerkId}`, JSON.stringify(session))
  }, { clerkId: account.clerkId, role: account.role, school: SCHOOL })
}

// Helper to wait for page content after navigation
async function goAndWait(page: Page, path: string) {
  await page.goto(`${BASE}${path}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
}

// ════════════════════════════════════════════════════════════
//  STUDENT TESTS
// ════════════════════════════════════════════════════════════

test.describe('Student role', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
  })

  test('Dashboard loads with greeting or clubs', async ({ page }) => {
    await goAndWait(page, '/dashboard')
    // TopBar shows "My Clubs"
    await expect(page.locator('h1:has-text("My Clubs")')).toBeVisible({ timeout: 15_000 })
    // Page content: either "Hi," greeting or "Welcome to ClubIt!" empty state
    const content = page.locator('text=/Hi,|Welcome to ClubIt/i').first()
    await expect(content).toBeVisible({ timeout: 15_000 })
  })

  test('Clubs directory loads with search', async ({ page }) => {
    await goAndWait(page, '/clubs')
    await expect(page.locator('h1:has-text("All Clubs")')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('input[placeholder*="Find"], input[placeholder*="find"], input[placeholder*="tribe"]')).toBeVisible()
  })

  test('Events page loads', async ({ page }) => {
    await goAndWait(page, '/events')
    await expect(page.locator('h1:has-text("Events")')).toBeVisible({ timeout: 15_000 })
  })

  test('Chat page loads', async ({ page }) => {
    await goAndWait(page, '/chat')
    await expect(page.locator('h1:has-text("Chat")')).toBeVisible({ timeout: 15_000 })
  })

  test('Elections page loads', async ({ page }) => {
    await goAndWait(page, '/elections')
    await expect(page.locator('h1:has-text("Elections")').first()).toBeVisible({ timeout: 15_000 })
  })

  test('Profile page loads with student badge', async ({ page }) => {
    await goAndWait(page, '/profile')
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)
    await expect(page.locator('text=/student/i').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Settings page loads with privacy toggles', async ({ page }) => {
    await goAndWait(page, '/settings')
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 15_000 })
    // Students should see privacy-related toggles
    await expect(page.locator('text=/achievement|attendance|privacy/i').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Sidebar has correct nav links', async ({ page }) => {
    await goAndWait(page, '/dashboard')
    await expect(page.locator('nav a[href="/dashboard"]')).toBeVisible()
    await expect(page.locator('nav a[href="/clubs"]')).toBeVisible()
    await expect(page.locator('nav a[href="/chat"]')).toBeVisible()
    await expect(page.locator('nav a[href="/events"]')).toBeVisible()
    await expect(page.locator('nav a[href="/elections"]')).toBeVisible()
    await expect(page.locator('nav a[href="/profile"]')).toBeVisible()
    // Student should NOT see admin
    await expect(page.locator('nav a[href="/admin"]')).not.toBeVisible()
  })

  test('Cannot access admin page — gets redirected', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(4000)
    expect(page.url()).not.toMatch(/\/admin$/)
  })

  test('Navigate between pages via sidebar', async ({ page }) => {
    await goAndWait(page, '/dashboard')

    await page.locator('nav a[href="/clubs"]').click()
    await page.waitForURL('**/clubs', { timeout: 15_000 })
    await expect(page.locator('h1:has-text("All Clubs")')).toBeVisible()

    await page.locator('nav a[href="/chat"]').click()
    await page.waitForURL('**/chat', { timeout: 15_000 })
    await expect(page.locator('h1:has-text("Chat")')).toBeVisible()

    await page.locator('nav a[href="/events"]').click()
    await page.waitForURL('**/events', { timeout: 15_000 })
    await expect(page.locator('h1:has-text("Events")')).toBeVisible()
  })
})

// ════════════════════════════════════════════════════════════
//  ADVISOR TESTS
// ════════════════════════════════════════════════════════════

test.describe('Advisor role', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, ACCOUNTS.advisor)
  })

  test('Dashboard loads with greeting', async ({ page }) => {
    await goAndWait(page, '/dashboard')
    await expect(page.locator('h1:has-text("My Clubs")')).toBeVisible({ timeout: 15_000 })
    const content = page.locator('text=/Hi,|Welcome to ClubIt/i')
    await expect(content).toBeVisible({ timeout: 15_000 })
  })

  test('Clubs directory loads', async ({ page }) => {
    await goAndWait(page, '/clubs')
    await expect(page.locator('h1:has-text("All Clubs")')).toBeVisible({ timeout: 15_000 })
  })

  test('Chat page loads', async ({ page }) => {
    await goAndWait(page, '/chat')
    await expect(page.locator('h1:has-text("Chat")')).toBeVisible({ timeout: 15_000 })
  })

  test('Events page loads', async ({ page }) => {
    await goAndWait(page, '/events')
    await expect(page.locator('h1:has-text("Events")')).toBeVisible({ timeout: 15_000 })
  })

  test('Elections page loads', async ({ page }) => {
    await goAndWait(page, '/elections')
    await expect(page.locator('h1:has-text("Elections")').first()).toBeVisible({ timeout: 15_000 })
  })

  test('Profile page shows advisor badge', async ({ page }) => {
    await goAndWait(page, '/profile')
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)
    await expect(page.locator('text=/advisor/i').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Settings page loads', async ({ page }) => {
    await goAndWait(page, '/settings')
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 15_000 })
  })

  test('Sidebar has correct links (no admin)', async ({ page }) => {
    await goAndWait(page, '/dashboard')
    await expect(page.locator('nav a[href="/dashboard"]')).toBeVisible()
    await expect(page.locator('nav a[href="/clubs"]')).toBeVisible()
    await expect(page.locator('nav a[href="/profile"]')).toBeVisible()
    await expect(page.locator('nav a[href="/admin"]')).not.toBeVisible()
  })

  test('Cannot access admin page', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(4000)
    expect(page.url()).not.toMatch(/\/admin$/)
  })
})

// ════════════════════════════════════════════════════════════
//  ADMIN TESTS
// ════════════════════════════════════════════════════════════

test.describe('Admin role', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, ACCOUNTS.admin)
  })

  test('Admin page loads with invite codes', async ({ page }) => {
    await goAndWait(page, '/admin')
    await expect(page.locator('h1:has-text("Admin")')).toBeVisible({ timeout: 15_000 })
    // Invite codes section should be visible
    await expect(page.locator('text=/invite code/i').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Admin page has clubs section', async ({ page }) => {
    await goAndWait(page, '/admin')
    await expect(page.locator('h1:has-text("Admin")')).toBeVisible({ timeout: 15_000 })
    // Should show clubs management
    const clubsHeader = page.locator('text=/clubs/i')
    await expect(clubsHeader.first()).toBeVisible({ timeout: 10_000 })
  })

  test('Admin page has staff & roles', async ({ page }) => {
    await goAndWait(page, '/admin')
    await expect(page.locator('h1:has-text("Admin")')).toBeVisible({ timeout: 15_000 })
    const staffSection = page.locator('text=/staff|roles|roster/i')
    await expect(staffSection.first()).toBeVisible({ timeout: 10_000 })
  })

  test('Sidebar has admin and billing links', async ({ page }) => {
    await goAndWait(page, '/admin')
    await expect(page.locator('nav a[href="/admin"]')).toBeVisible()
    await expect(page.locator('nav a[href="/admin/billing"]')).toBeVisible()
    await expect(page.locator('nav a[href="/clubs"]')).toBeVisible()
  })

  test('Billing page loads', async ({ page }) => {
    await goAndWait(page, '/admin/billing')
    await expect(page.locator('h1:has-text("Billing")')).toBeVisible({ timeout: 15_000 })
  })

  test('Clubs directory loads', async ({ page }) => {
    await goAndWait(page, '/clubs')
    await expect(page.locator('h1:has-text("All Clubs")')).toBeVisible({ timeout: 15_000 })
  })

  test('Chat page loads', async ({ page }) => {
    await goAndWait(page, '/chat')
    await expect(page.locator('h1:has-text("Chat")')).toBeVisible({ timeout: 15_000 })
  })

  test('Events page loads', async ({ page }) => {
    await goAndWait(page, '/events')
    await expect(page.locator('h1:has-text("Events")')).toBeVisible({ timeout: 15_000 })
  })

  test('Elections page loads', async ({ page }) => {
    await goAndWait(page, '/elections')
    await expect(page.locator('h1:has-text("Elections")').first()).toBeVisible({ timeout: 15_000 })
  })

  test('Profile page shows admin badge', async ({ page }) => {
    await goAndWait(page, '/profile')
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)
    await expect(page.locator('text=/admin/i').first()).toBeVisible({ timeout: 10_000 })
  })

  test('Settings page has admin feature controls', async ({ page }) => {
    await goAndWait(page, '/settings')
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)
    // Admin should see student feature control toggles
    await expect(page.locator('text=/student feature|feature control/i').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ════════════════════════════════════════════════════════════
//  CROSS-ROLE / SECURITY TESTS
// ════════════════════════════════════════════════════════════

test.describe('Cross-role and security', () => {
  test('Unauthenticated → redirected from dashboard', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForTimeout(5000)
    const url = page.url()
    expect(url.includes('/sign-in') || url.includes('/landing') || url.includes('/join')).toBe(true)
  })

  test('Unauthenticated → redirected from admin', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(5000)
    expect(page.url()).not.toMatch(/\/admin$/)
  })

  test('Join API rejects unauthenticated requests', async ({ request }) => {
    const res = await request.post(`${BASE}/api/join`, {
      data: { code: 'FAKE-STU-CODE' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(401)
  })

  test('Student sign-in → dashboard (not /join)', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/dashboard')
    expect(page.url()).toContain('/dashboard')
    await expect(page.locator('h1:has-text("My Clubs")')).toBeVisible({ timeout: 15_000 })
  })
})
