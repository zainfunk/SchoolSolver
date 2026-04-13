import { test, expect } from '@playwright/test'

/*
 * CREATE TEST ACCOUNTS
 *
 * Creates accounts via Clerk Backend API, signs in using sign-in tokens
 * (bypasses CAPTCHA and email verification), then enters invite codes.
 *
 * Run all sequentially:
 *   npx playwright test tests/e2e/create-accounts.spec.ts --headed --workers=1
 *
 * Run one role:
 *   npx playwright test tests/e2e/create-accounts.spec.ts --headed -g "student"
 */

const BASE = 'http://localhost:3000'
const CLERK_SECRET = '***REMOVED-CLERK-SECRET***'

const ACCOUNTS = {
  student: {
    email: 'rithmohanty07+1@gmail.com',
    username: 'clubit_student_test',
    password: 'ClubIt_Test!2026',
    code: '4LUT-STU-XMVV',
  },
  advisor: {
    email: 'rithmohanty07+2@gmail.com',
    username: 'clubit_advisor_test',
    password: 'ClubIt_Test!2026',
    code: 'M9XL-ADV-KWAX',
  },
  admin: {
    email: 'rithmohanty07+3@gmail.com',
    username: 'clubit_admin_test',
    password: 'ClubIt_Test!2026',
    code: 'Q8BT-ADM-YAVX',
  },
}

async function ensureClerkUser(creds: typeof ACCOUNTS.student): Promise<string> {
  // Check if user exists (exact email match)
  const checkRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(creds.email)}`,
    { headers: { Authorization: `Bearer ${CLERK_SECRET}` } }
  )
  const existing = await checkRes.json() as any[]

  if (existing.length > 0) {
    console.log(`  User exists: ${creds.email} (${existing[0].id})`)
    return existing[0].id
  }

  // Create new user
  const res = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [creds.email],
      username: creds.username,
      password: creds.password,
      skip_password_checks: true,
    }),
  })
  const body = await res.json() as any
  if (!res.ok) {
    throw new Error(`Clerk create failed: ${body.errors?.[0]?.long_message || JSON.stringify(body)}`)
  }
  console.log(`  Created user: ${creds.email} (${body.id})`)
  return body.id
}

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
  if (!res.ok) {
    throw new Error(`Sign-in token failed: ${JSON.stringify(body)}`)
  }
  // Extract the ticket from the URL
  const url = new URL(body.url)
  return url.searchParams.get('__clerk_ticket')!
}

for (const [role, creds] of Object.entries(ACCOUNTS)) {
  test(`Create ${role} account`, async ({ page }) => {
    test.setTimeout(300_000)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`  ${role.toUpperCase()} ACCOUNT`)
    console.log(`  Email:    ${creds.email}`)
    console.log(`  Password: ${creds.password}`)
    console.log(`  Code:     ${creds.code}`)
    console.log(`${'='.repeat(60)}`)

    // Step 1: Create/ensure user
    console.log('\n  Ensuring user exists...')
    const userId = await ensureClerkUser(creds)

    // Step 2: Get sign-in ticket and use it to sign in (bypasses CAPTCHA + email verification)
    console.log('  Getting sign-in ticket...')
    const ticket = await getSignInTicket(userId)

    console.log('  Signing in via ticket...')
    await page.goto(`${BASE}/sign-in?__clerk_ticket=${ticket}`)

    // Wait for Clerk to process the ticket and redirect
    await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
    console.log(`  Signed in! URL: ${page.url()}`)

    // Step 3: Go to /join and enter invite code
    console.log('  Navigating to /join...')
    await page.goto(`${BASE}/join`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check if already redirected (user might already be in a school)
    if (!page.url().includes('/join')) {
      console.log(`  Redirected to ${page.url()} — user already in a school`)
      console.log(`\n  [${role.toUpperCase()}] DONE (already set up)\n`)
      return
    }

    // Enter invite code
    console.log('  Entering invite code...')
    const codeInput = page.locator('input[placeholder="XXXX-STU-XXXX"]')
    await codeInput.waitFor({ state: 'visible', timeout: 15_000 })
    await codeInput.fill(creds.code)

    const joinButton = page.locator('button:has-text("Join school")')
    await joinButton.click()

    // Wait for success or error
    const result = await Promise.race([
      page.locator('text=Welcome to').waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'success'),
      page.locator('.text-red-600').waitFor({ state: 'visible', timeout: 20_000 }).then(async () => {
        return `error: ${await page.locator('.text-red-600').textContent()}`
      }),
    ])

    if (result === 'success') {
      console.log(`\n  [${role.toUpperCase()}] SUCCESS! Joined school.`)
      await page.waitForURL(/\/(dashboard|admin)/, { timeout: 30_000 })
      console.log(`  Redirected to: ${page.url()}`)
    } else {
      console.log(`\n  [${role.toUpperCase()}] ${result}`)
    }

    console.log(`  [${role.toUpperCase()}] Done!\n`)
  })
}
