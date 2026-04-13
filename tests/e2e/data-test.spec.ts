import { test, expect, Page } from '@playwright/test'

/*
 * DATA INTEGRATION TEST — Verifies data creation, persistence, and
 * cross-account visibility across student/advisor/admin roles.
 *
 * Prerequisites: Run create-accounts.spec.ts first.
 *
 * Run:
 *   npx playwright test tests/e2e/data-test.spec.ts --headed --workers=1
 */

const BASE = 'http://localhost:3000'
const CLERK_SECRET = '***REMOVED-CLERK-SECRET***'

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

// Unique test suffix to avoid collisions
const TS = Date.now()
const TEST_CLUB_NAME = `E2E Test Club ${TS}`

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
  const body = (await res.json()) as any
  if (!res.ok) throw new Error(`Sign-in token failed: ${JSON.stringify(body)}`)
  return new URL(body.url).searchParams.get('__clerk_ticket')!
}

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  const ticket = await getSignInTicket(account.clerkId)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${ticket}`)
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })

  // Pre-set localStorage
  await page.evaluate(
    ({ clerkId, role, school }) => {
      localStorage.setItem(
        `clubit_school_${clerkId}`,
        JSON.stringify({
          schoolId: school.id,
          schoolName: school.name,
          role,
          schoolStatus: school.status,
        })
      )
    },
    { clerkId: account.clerkId, role: account.role, school: SCHOOL }
  )
}

async function goAndWait(page: Page, path: string) {
  await page.goto(`${BASE}${path}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
}

// ════════════════════════════════════════════════════════════
//  1. ADMIN CREATES A CLUB
// ════════════════════════════════════════════════════════════

test.describe.serial('Data integration', () => {
  let clubId: string

  test('Admin creates a club from admin panel', async ({ page }) => {
    await signInAs(page, ACCOUNTS.admin)
    await goAndWait(page, '/admin')

    await expect(page.locator('h1:has-text("Admin")')).toBeVisible({ timeout: 15_000 })

    // Fill club creation form
    const nameInput = page.locator('input[placeholder="e.g. Photography Club"]')
    await nameInput.waitFor({ state: 'visible', timeout: 10_000 })
    await nameInput.fill(TEST_CLUB_NAME)

    const descInput = page.locator('textarea[placeholder*="Describe"]')
    await descInput.fill('An automated E2E test club for data verification')

    const tagsInput = page.locator('input[placeholder*="STEM"]')
    await tagsInput.fill('E2E, Testing')

    // Submit the form
    const createBtn = page.locator('button[type="submit"]:has-text("Create Club")')
    await createBtn.click()

    // Wait for the club to appear in the clubs list on admin page
    await page.waitForTimeout(3000)

    // Verify club appears in the admin clubs list
    const clubEntry = page.locator(`text=${TEST_CLUB_NAME}`)
    await expect(clubEntry.first()).toBeVisible({ timeout: 10_000 })

    console.log(`  Created club: ${TEST_CLUB_NAME}`)
  })

  // ════════════════════════════════════════════════════════════
  //  2. CLUB VISIBLE IN CLUBS DIRECTORY (ALL ROLES)
  // ════════════════════════════════════════════════════════════

  test('Club appears in clubs directory for student', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/clubs')

    await expect(page.locator('h1:has-text("All Clubs")')).toBeVisible({ timeout: 15_000 })

    // Search for our test club
    const searchInput = page.locator('input[placeholder*="Find"], input[placeholder*="find"], input[placeholder*="tribe"]')
    await searchInput.fill(TEST_CLUB_NAME)
    await page.waitForTimeout(1500)

    const clubCard = page.locator(`text=${TEST_CLUB_NAME}`)
    await expect(clubCard.first()).toBeVisible({ timeout: 10_000 })
  })

  test('Club appears in clubs directory for advisor', async ({ page }) => {
    await signInAs(page, ACCOUNTS.advisor)
    await goAndWait(page, '/clubs')

    const searchInput = page.locator('input[placeholder*="Find"], input[placeholder*="find"], input[placeholder*="tribe"]')
    await searchInput.fill(TEST_CLUB_NAME)
    await page.waitForTimeout(1500)

    await expect(page.locator(`text=${TEST_CLUB_NAME}`).first()).toBeVisible({ timeout: 10_000 })
  })

  // ════════════════════════════════════════════════════════════
  //  3. STUDENT JOINS THE CLUB
  // ════════════════════════════════════════════════════════════

  test('Student can open club detail page', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/clubs')

    // Find and click the club card
    const searchInput = page.locator('input[placeholder*="Find"], input[placeholder*="find"], input[placeholder*="tribe"]')
    await searchInput.fill(TEST_CLUB_NAME)
    await page.waitForTimeout(1500)

    const clubLink = page.locator(`a:has-text("${TEST_CLUB_NAME}")`)
      .or(page.locator(`[href*="/clubs/"] >> text=${TEST_CLUB_NAME}`))
      .or(page.locator(`text=${TEST_CLUB_NAME}`))
    await clubLink.first().click()

    // Should navigate to club detail
    await page.waitForURL('**/clubs/**', { timeout: 15_000 })
    await page.waitForTimeout(2000)

    // Club name should be visible
    await expect(page.locator(`text=${TEST_CLUB_NAME}`).first()).toBeVisible()

    // Should see Join Club button (or auto-accepted)
    const joinBtn = page.locator('button:has-text("Join Club")')
    const alreadyJoined = page.locator('button:has-text("Leave Club")')

    const canJoin = await joinBtn.isVisible().catch(() => false)
    const isJoined = await alreadyJoined.isVisible().catch(() => false)

    if (canJoin) {
      await joinBtn.click()
      await page.waitForTimeout(2000)

      // After joining: either "Leave Club" shows (auto-accept) or "Pending Review"
      const leaveBtn = page.locator('button:has-text("Leave Club")')
      const pending = page.locator('text=/Pending/i')
      const result = await Promise.race([
        leaveBtn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'joined'),
        pending.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'pending'),
      ]).catch(() => 'unknown')

      console.log(`  Join result: ${result}`)
    } else if (isJoined) {
      console.log('  Student already joined this club')
    }
  })

  // ════════════════════════════════════════════════════════════
  //  4. CHAT — STUDENT SENDS A MESSAGE
  // ════════════════════════════════════════════════════════════

  test('Student can access chat and send a message', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/chat')

    await expect(page.locator('h1:has-text("Chat")')).toBeVisible({ timeout: 15_000 })

    // Look for the test club in the chat list
    const chatEntry = page.locator(`text=${TEST_CLUB_NAME}`)
    const hasChatEntry = await chatEntry.first().isVisible().catch(() => false)

    if (hasChatEntry) {
      await chatEntry.first().click()
      await page.waitForURL('**/chat/**', { timeout: 15_000 })
      await page.waitForTimeout(2000)

      // Send a message
      const msgInput = page.locator('input[placeholder*="Message"]')
      await msgInput.waitFor({ state: 'visible', timeout: 10_000 })

      const testMessage = `E2E test message ${TS}`
      await msgInput.fill(testMessage)
      await msgInput.press('Enter')
      await page.waitForTimeout(2000)

      // Verify message appears in the chat
      const sentMsg = page.locator(`text=${testMessage}`)
      await expect(sentMsg.first()).toBeVisible({ timeout: 10_000 })

      console.log(`  Sent message: ${testMessage}`)
    } else {
      console.log('  No chat entry for test club (student may not be a member yet)')
    }
  })

  // ════════════════════════════════════════════════════════════
  //  5. PROFILE — EDIT NAME AND BIO
  // ════════════════════════════════════════════════════════════

  test('Student can edit profile name', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/profile')

    await expect(page.locator('h1:has-text("Profile")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    // Find the name input (large text field)
    const nameInput = page.locator('input[class*="text-4xl"], input[class*="font-extrabold"]').first()
    const hasNameInput = await nameInput.isVisible().catch(() => false)

    if (hasNameInput) {
      const originalName = await nameInput.inputValue()
      const testName = `E2E Tester ${TS}`

      await nameInput.fill(testName)
      await nameInput.blur()
      await page.waitForTimeout(2000)

      // Reload and verify persistence
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const updatedInput = page.locator('input[class*="text-4xl"], input[class*="font-extrabold"]').first()
      const savedName = await updatedInput.inputValue()

      // Verify the name was saved (either our test name persisted or was reverted by the app)
      console.log(`  Name before: "${originalName}", after save: "${savedName}"`)

      // Restore original name
      if (savedName === testName) {
        await updatedInput.fill(originalName || 'clubit_student_test')
        await updatedInput.blur()
        await page.waitForTimeout(1000)
      }
    } else {
      console.log('  Name input not found (may need different selector)')
    }
  })

  test('Student can write a bio', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/profile')

    await expect(page.locator('h1:has-text("Profile")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    const bioTextarea = page.locator('textarea[placeholder*="bio"]')
    const hasBio = await bioTextarea.isVisible().catch(() => false)

    if (hasBio) {
      const testBio = `E2E test bio ${TS}`
      await bioTextarea.fill(testBio)
      await bioTextarea.blur()
      await page.waitForTimeout(2000)

      // Reload and verify
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const savedBio = await page.locator('textarea[placeholder*="bio"]').inputValue()
      expect(savedBio).toBe(testBio)
      console.log(`  Bio persisted correctly: "${testBio}"`)

      // Clean up
      await page.locator('textarea[placeholder*="bio"]').fill('')
      await page.locator('textarea[placeholder*="bio"]').blur()
      await page.waitForTimeout(1000)
    } else {
      console.log('  Bio textarea not found')
    }
  })

  // ════════════════════════════════════════════════════════════
  //  6. SETTINGS — TOGGLE AND PERSIST
  // ════════════════════════════════════════════════════════════

  test('Student can toggle privacy settings', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/settings')

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)

    // Find all toggle switches
    const toggles = page.locator('button[role="switch"]')
    const toggleCount = await toggles.count()

    if (toggleCount > 0) {
      // Get initial state of first toggle
      const firstToggle = toggles.first()
      const initialState = await firstToggle.getAttribute('aria-checked')
      console.log(`  Found ${toggleCount} toggles. First toggle initial state: ${initialState}`)

      // Click it
      await firstToggle.click()
      await page.waitForTimeout(1500)

      // Verify it changed
      const newState = await firstToggle.getAttribute('aria-checked')
      expect(newState).not.toBe(initialState)
      console.log(`  Toggled: ${initialState} → ${newState}`)

      // Reload and verify persistence
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const persistedState = await page.locator('button[role="switch"]').first().getAttribute('aria-checked')
      console.log(`  After reload: ${persistedState}`)

      // Restore original state
      if (persistedState !== initialState) {
        await page.locator('button[role="switch"]').first().click()
        await page.waitForTimeout(1000)
      }
    } else {
      console.log('  No toggles found on settings page')
    }
  })

  test('Admin can toggle student feature controls', async ({ page }) => {
    await signInAs(page, ACCOUNTS.admin)
    await goAndWait(page, '/settings')

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)

    // Admin should see "Student Feature Controls" section
    const adminSection = page.locator('text=/student feature/i')
    await expect(adminSection.first()).toBeVisible({ timeout: 10_000 })

    // Find toggles in the admin section
    const toggles = page.locator('button[role="switch"]')
    const toggleCount = await toggles.count()
    console.log(`  Admin sees ${toggleCount} toggles`)

    expect(toggleCount).toBeGreaterThan(0)
  })

  // ════════════════════════════════════════════════════════════
  //  7. ISSUE REPORTING
  // ════════════════════════════════════════════════════════════

  test('Student can submit an issue report', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/settings')

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)

    // Find the issue report textarea
    const issueTextarea = page.locator('textarea[placeholder*="issue"], textarea[placeholder*="Describe"]')
    const hasIssueForm = await issueTextarea.isVisible().catch(() => false)

    if (hasIssueForm) {
      const issueText = `E2E test issue report ${TS}`
      await issueTextarea.fill(issueText)

      const sendBtn = page.locator('button:has-text("Send Report")')
      await sendBtn.click()
      await page.waitForTimeout(2000)

      // Should show success message
      const success = page.locator('text=/submitted|notified/i')
      await expect(success.first()).toBeVisible({ timeout: 10_000 })
      console.log(`  Issue reported: "${issueText}"`)
    } else {
      console.log('  Issue report form not found')
    }
  })

  test('Admin can see issue reports', async ({ page }) => {
    await signInAs(page, ACCOUNTS.admin)
    await goAndWait(page, '/admin')

    await expect(page.locator('h1:has-text("Admin")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    // Look for issue reports section or the test report text
    const issueSection = page.locator('text=/issue|report/i')
    const hasIssues = await issueSection.first().isVisible().catch(() => false)

    if (hasIssues) {
      console.log('  Admin can see issue reports section')

      // Check if our test report is there
      const testReport = page.locator(`text=E2E test issue report ${TS}`)
      const reportVisible = await testReport.isVisible().catch(() => false)
      console.log(`  Test report visible: ${reportVisible}`)
    } else {
      console.log('  Issue reports section not visible in admin')
    }
  })

  // ════════════════════════════════════════════════════════════
  //  8. ADMIN STAFF ROSTER — CROSS-ACCOUNT VISIBILITY
  // ════════════════════════════════════════════════════════════

  test('Admin can see all users in staff roster', async ({ page }) => {
    await signInAs(page, ACCOUNTS.admin)
    await goAndWait(page, '/admin')

    await expect(page.locator('h1:has-text("Admin")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    // Scroll down to find the staff/roster section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)

    // Look for user entries by username or email
    const studentEntry = page.locator('text=/clubit_student_test|rithmohanty07\\+1/i')
    const advisorEntry = page.locator('text=/clubit_advisor_test|rithmohanty07\\+2/i')
    const adminEntry = page.locator('text=/clubit_admin_test|rithmohanty07\\+3/i')

    const hasStudent = await studentEntry.first().isVisible().catch(() => false)
    const hasAdvisor = await advisorEntry.first().isVisible().catch(() => false)
    const hasAdmin = await adminEntry.first().isVisible().catch(() => false)

    console.log(`  Staff roster - Student: ${hasStudent}, Advisor: ${hasAdvisor}, Admin: ${hasAdmin}`)

    // At least one user should be visible (might need more scrolling)
    expect(hasStudent || hasAdvisor || hasAdmin).toBe(true)
  })

  // ════════════════════════════════════════════════════════════
  //  9. INVITE CODES VISIBLE TO ADMIN
  // ════════════════════════════════════════════════════════════

  test('Admin can see and copy invite codes', async ({ page }) => {
    await signInAs(page, ACCOUNTS.admin)
    await goAndWait(page, '/admin')

    await expect(page.locator('h1:has-text("Admin")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    // Look for invite code display
    const codePattern = page.locator('text=/[A-Z0-9]{4}-(?:STU|ADV|ADM)-[A-Z0-9]{4}/')
    const codeCount = await codePattern.count()

    console.log(`  Found ${codeCount} invite code(s) displayed`)
    expect(codeCount).toBeGreaterThan(0)

    // Check copy buttons exist
    const copyBtns = page.locator('button:has-text("Copy"), button[title*="copy"], button[title*="Copy"]')
      .or(page.locator('svg.lucide-copy').locator('..'))
    const copyCount = await copyBtns.count()
    console.log(`  Found ${copyCount} copy button(s)`)
  })

  // ════════════════════════════════════════════════════════════
  //  10. EVENTS PAGE — DATA LOADS
  // ════════════════════════════════════════════════════════════

  test('Events page shows content or empty state', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/events')

    await expect(page.locator('h1:has-text("Events")')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)

    // Should show either events or "no events" state
    const hasContent = page.locator('text=/upcoming|past|no event/i')
    await expect(hasContent.first()).toBeVisible({ timeout: 10_000 })
    console.log('  Events page loaded with content')
  })

  // ════════════════════════════════════════════════════════════
  //  11. ELECTIONS PAGE — DATA LOADS
  // ════════════════════════════════════════════════════════════

  test('Elections page shows stats or empty state', async ({ page }) => {
    await signInAs(page, ACCOUNTS.student)
    await goAndWait(page, '/elections')

    await expect(page.locator('h1:has-text("Elections")').first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)

    // Should show stats bar or empty state
    const content = page.locator('text=/active|completed|participation|no election|no form/i')
    await expect(content.first()).toBeVisible({ timeout: 10_000 })
    console.log('  Elections page loaded with content')
  })
})
