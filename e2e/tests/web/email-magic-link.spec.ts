import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { waitForMagicLinkEmail } from '../../support/mailpit'
import { createEmailTrialUser, newEmail, preseedEmailTrialUser } from '../../support/users'

/** Ask for a magic link through the /email-login form and return the callback URL from Mailpit. */
async function requestLinkViaUi(page: Page, email: string): Promise<string> {
  const since = new Date(Date.now() - 1000)
  await page.goto('/email-login')
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Send Magic Link' }).click()
  await expect(page.getByText('Check your inbox!')).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()
  const { callbackUrl } = await waitForMagicLinkEmail(email, { since })
  return callbackUrl
}

test.describe('Email magic-link login', () => {
  test('a new email gets a 24h email trial and is sent to onboarding', async ({ page }) => {
    const email = newEmail('e2e-magic')
    const callbackUrl = await requestLinkViaUi(page, email)

    await page.goto(callbackUrl)
    await expect(page).toHaveURL(/\/onboarding/)

    const status = await page.request.get('/api/auth/status')
    expect(status.ok()).toBe(true)
    const { user } = await status.json()
    expect(user.authMethod).toBe('EMAIL')
    expect(user.subscriptionStatus).toBe('FREE')
    const expiresMs = new Date(user.emailTrialExpiresAt).getTime() - Date.now()
    expect(Math.abs(expiresMs - 24 * 60 * 60 * 1000)).toBeLessThan(5 * 60 * 1000)
  })

  test('request a link in the UI, open it from Mailpit, see the trial pill on the dashboard', async ({ page }) => {
    const email = newEmail('e2e-pill')
    await preseedEmailTrialUser(email) // profile first, so the login lands past onboarding
    const callbackUrl = await requestLinkViaUi(page, email)

    await page.goto(callbackUrl)
    await expect(page).toHaveURL(/\/dashboard/)
    // Sidebar on desktop, mobile header on phone: take the visible one.
    const pill = page.getByRole('button', { name: /Trial ends/ }).filter({ visible: true }).first()
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await expect(pill).toHaveAccessibleName(/Trial ends in \d{2}:\d{2}:\d{2}/)
  })

  // The callback answers with raw JSON (handleApiError), so these assert status + error code.
  // The user-facing page is tracked in issue #140 (test.fail below).
  test('an expired magic link is rejected with 400 TOKEN_EXPIRED', async ({ page, db }) => {
    const email = newEmail('e2e-expired')
    const callbackUrl = await requestLinkViaUi(page, email)
    const token = new URL(callbackUrl).searchParams.get('token')!
    await db.magicLink.update({ where: { token }, data: { expiresAt: new Date(Date.now() - 60_000) } })

    const res = await page.request.get(callbackUrl)
    expect(res.status()).toBe(400)
    expect((await res.json()).error.code).toBe('TOKEN_EXPIRED')
    expect((await page.request.get('/api/auth/status')).ok()).toBe(false)
  })

  test('a reused magic link is rejected with 400 TOKEN_USED', async ({ page }) => {
    const email = newEmail('e2e-reused')
    const callbackUrl = await requestLinkViaUi(page, email)

    await page.goto(callbackUrl)
    await expect(page).toHaveURL(/\/onboarding|\/dashboard/)

    const res = await page.request.get(callbackUrl)
    expect(res.status()).toBe(400)
    expect((await res.json()).error.code).toBe('TOKEN_USED')
  })

  test('an unknown token is rejected with 400 INVALID_TOKEN', async ({ page }) => {
    const res = await page.request.get('/api/auth/magic-link/callback?token=not-a-real-token')
    expect(res.status()).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_TOKEN')
  })

  // Issue #140: bad links render raw JSON instead of a user-facing page.
  test('an expired magic link shows a user-facing error', async ({ page, db }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/140')
    const email = newEmail('e2e-expired-ui')
    const callbackUrl = await requestLinkViaUi(page, email)
    const token = new URL(callbackUrl).searchParams.get('token')!
    await db.magicLink.update({ where: { token }, data: { expiresAt: new Date(Date.now() - 60_000) } })
    await page.goto(callbackUrl)
    await expect(page.getByRole('alert').or(page.getByRole('heading'))).toBeVisible({ timeout: 3_000 })
  })

  test('a reused magic link shows a user-facing error', async ({ page }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/140')
    const email = newEmail('e2e-reused-ui')
    const callbackUrl = await requestLinkViaUi(page, email)
    await page.goto(callbackUrl)
    await expect(page).toHaveURL(/\/onboarding|\/dashboard/)
    await page.goto(callbackUrl)
    await expect(page.getByRole('alert').or(page.getByRole('heading'))).toBeVisible({ timeout: 3_000 })
  })

  test('an unknown magic link shows a user-facing error', async ({ page }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/140')
    await page.goto('/api/auth/magic-link/callback?token=not-a-real-token')
    await expect(page.getByRole('alert').or(page.getByRole('heading'))).toBeVisible({ timeout: 3_000 })
  })
})

test.describe('createEmailTrialUser helper', () => {
  test('returns a logged-in email-trial context that lands on the dashboard with the trial pill', async ({ browser }) => {
    const { context, email } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('button', { name: /Trial ends/ }).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 })
    const { user } = await (await page.request.get('/api/auth/status')).json()
    expect(user.email).toBe(email)
    expect(user.authMethod).toBe('EMAIL')
    await context.close()
  })

  test('default (no profile) sets the email trial on the create path', async ({ browser }) => {
    const { context, email } = await createEmailTrialUser(browser)
    try {
      const { user } = await (await context.request.get('/api/auth/status')).json()
      expect(user.email).toBe(email)
      const expiresMs = new Date(user.emailTrialExpiresAt).getTime() - Date.now()
      expect(Math.abs(expiresMs - 24 * 60 * 60 * 1000)).toBeLessThan(5 * 60 * 1000)
    } finally {
      await context.close()
    }
  })
})
