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
  test('a new email gets a 24h email trial and is sent to onboarding', async ({ page, db }) => {
    const email = newEmail('e2e-magic')
    const callbackUrl = await requestLinkViaUi(page, email)

    await page.goto(callbackUrl)
    await expect(page).toHaveURL(/\/onboarding/)

    const status = await page.request.get('/api/auth/status')
    expect(status.ok()).toBe(true)
    const { user } = await status.json()
    expect(user.authMethod).toBe('EMAIL')
    expect(user.subscriptionStatus).toBe('FREE')
    expect(user.emailTrialExpiresAt).toBeTruthy()
    expect(await db.user.count({ where: { email } })).toBe(1)
  })

  test('request a link in the UI, open it from Mailpit, see the trial pill on the dashboard', async ({ page }) => {
    const email = newEmail('e2e-pill')
    await preseedEmailTrialUser(email) // profile first, so the login lands past onboarding
    const callbackUrl = await requestLinkViaUi(page, email)

    await page.goto(callbackUrl)
    await expect(page).toHaveURL(/\/dashboard/)
    // Sidebar on desktop, mobile header on phone: take the visible one.
    const pill = page.locator('button[aria-label*="Trial ends"]:visible').first()
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await expect(pill).toHaveAttribute('aria-label', /Trial ends in \d{2}:\d{2}:\d{2}/)
  })

  test('an expired magic link is rejected with a visible message', async ({ page, db }) => {
    const email = newEmail('e2e-expired')
    const callbackUrl = await requestLinkViaUi(page, email)

    const token = new URL(callbackUrl).searchParams.get('token')!
    await db.magicLink.update({ where: { token }, data: { expiresAt: new Date(Date.now() - 60_000) } })

    await page.goto(callbackUrl)
    await expect(page.getByText(/Magic link has expired/)).toBeVisible()
    const status = await page.request.get('/api/auth/status')
    expect(status.ok()).toBe(false)
  })

  test('a reused magic link is rejected with a visible message', async ({ page }) => {
    const email = newEmail('e2e-reused')
    const callbackUrl = await requestLinkViaUi(page, email)

    await page.goto(callbackUrl)
    await expect(page).toHaveURL(/\/onboarding|\/dashboard|\/\?auth=success/)

    await page.goto(callbackUrl)
    await expect(page.getByText(/Magic link has already been used/)).toBeVisible()
  })

  test('an unknown token is rejected with a visible message', async ({ page }) => {
    await page.goto('/api/auth/magic-link/callback?token=not-a-real-token')
    await expect(page.getByText(/Invalid or expired magic link/)).toBeVisible()
  })
})

test.describe('createEmailTrialUser helper', () => {
  test('returns a logged-in email-trial context that lands on the dashboard with the trial pill', async ({ browser }) => {
    const { context, email } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator('button[aria-label*="Trial ends"]:visible').first()).toBeVisible({ timeout: 15_000 })
    const { user } = await (await page.request.get('/api/auth/status')).json()
    expect(user.email).toBe(email)
    expect(user.authMethod).toBe('EMAIL')
    await context.close()
  })
})
