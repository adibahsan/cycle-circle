/**
 * Handbook chapters "Settings" and "Navigation & Language" (docs/handbook/chapters/settings.md and
 * navigation-and-language.md), ticket #244. Anchors and file names come from docs/handbook/OUTLINE.md.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../../support/fixtures.ts'
import { ensureUserProfile } from '../../../support/db.ts'
import { latestEmailFor, waitForMagicLinkEmail } from '../../../support/mailpit.ts'
import { extractVerificationCode } from '../../../support/bengali.ts'
import { statePath } from '../../../support/personas.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { URLS } from '../../../support/slot.ts'
import { ipFor } from '../../../support/users.ts'
import { demoEmailTrialUser, demoPhoneUser } from '../../support/demo-users.ts'
import { shot } from '../../support/shot.ts'

const PHONES = { addEmail: '01711223366', addPhone: '01711223377' } as const

/** Scroll a Settings block to just under the sticky header. */
async function centre(page: Page, text: string) {
  await page.getByText(text, { exact: true }).first().evaluate((el) => {
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 90, behavior: 'instant' })
  })
}

test.describe('Settings', () => {
  test.describe('seeded Users (read-only)', () => {
    test.use({ storageState: statePath('streaker') })

    test('overview, account, notifications, language, export, tour, legal, logout', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible()
      await shot(page, 'st-overview')

      await centre(page, 'Account')
      await shot(page, 'st-account')
      await centre(page, 'Plan')
      await shot(page, 'st-plan-badge')

      await centre(page, 'Notifications')
      await shot(page, 'st-notifications')

      await centre(page, 'Language & Appearance')
      await shot(page, 'st-language-theme')
      await page.getByRole('radio', { name: 'Dark' }).click()
      await shot(page, 'st-language-theme', { suffix: 'dark' })
      await page.getByRole('radio', { name: 'Light' }).click()

      await centre(page, 'Export Data')
      await shot(page, 'st-export')
      await page.getByLabel('Include all profiles in this account').check()
      await shot(page, 'st-export', { suffix: 'all-profiles' })

      await centre(page, 'Replay app tour')
      await shot(page, 'st-replay-tour')

      await centre(page, 'About')
      await shot(page, 'st-legal')

      await page.getByRole('button', { name: 'Log Out' }).click()
      await expect(page.getByText('Are you sure you want to log out?')).toBeVisible()
      await shot(page, 'st-logout')
      await page.getByRole('button', { name: 'Cancel' }).click()
    })
  })

  test('add an email to a phone account', async ({ browser }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONES.addEmail)
    try {
      await ensureUserProfile(PHONES.addEmail, { name: 'Rina' })
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/settings')
      await centre(page, 'Plan')
      await page.getByRole('button', { name: 'Add Email' }).click()
      const email = 'rina.demo@example.com'
      await page.getByLabel('Email', { exact: true }).fill('rina')
      await page.getByRole('button', { name: 'Send code' }).click()
      await expect(page.getByText('Enter a valid email address.')).toBeVisible()
      await shot(page, 'st-email', { suffix: 'invalid' })

      await page.getByLabel('Email', { exact: true }).fill(email)
      const since = new Date(Date.now() - 1000)
      await page.getByRole('button', { name: 'Send code' }).click()
      await expect(page.getByText(`We sent a 6-digit code to ${email}.`)).toBeVisible()
      await shot(page, 'st-email', { suffix: 'code' })

      const wrong = '000000'
      await page.getByRole('textbox', { name: 'Digit 1' }).fill(wrong)
      await page.getByRole('button', { name: 'Verify', exact: true }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'Invalid or expired code' })).toBeVisible()
      await shot(page, 'st-email', { suffix: 'wrong-code' })

      const msg = await latestEmailFor(email, { since })
      await page.getByRole('textbox', { name: 'Digit 1' }).fill(extractVerificationCode(msg.text, msg.html))
      await page.getByRole('button', { name: 'Verify', exact: true }).click()
      await expect(page.getByText('Email verified and saved.')).toBeVisible()
      await centre(page, 'Plan')
      await shot(page, 'st-email')
    } finally {
      await context.close()
    }
  })

  test('add a phone to an email-trial account, and the plan badge states', async ({ browser, fakeBdapps, db }, testInfo) => {
    const context = await demoEmailTrialUser(browser, testInfo.project.use, 'rina.settings@example.com')
    try {
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/settings')
      await centre(page, 'Plan')
      await shot(page, 'st-plan-badge', { suffix: 'free' })
      await page.getByRole('button', { name: 'Add Phone Number' }).click()
      await expect(page.getByRole('heading', { name: 'Keep your account' })).toBeVisible()
      await shot(page, 'st-phone')

      const phone = PHONES.addPhone
      await page.getByLabel('Mobile number').fill('0171')
      await page.getByRole('button', { name: 'Send code' }).click()
      await expect(page.getByText('Enter a valid Bangladeshi mobile number.')).toBeVisible()
      await shot(page, 'st-phone', { suffix: 'invalid-number' })

      await page.getByLabel('Mobile number').fill(phone)
      await page.getByRole('button', { name: 'Send code' }).click()
      await expect(page.getByRole('heading', { name: 'Enter the code' })).toBeVisible()
      await shot(page, 'st-phone', { suffix: 'code' })

      const otp = await fakeBdapps.latestOtp(phone)
      const wrong = otp.code === '000000' ? '999999' : '000000'
      await page.getByRole('textbox', { name: 'Digit 1' }).fill(wrong)
      await expect(page.getByRole('alert').filter({ hasText: 'Invalid or expired code' })).toBeVisible()
      await shot(page, 'st-phone', { suffix: 'wrong-code' })

      await page.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)
      await expect(page.getByText("Your number is verified — you're now on Pro!").first()).toBeVisible()
      await shot(page, 'st-phone', { suffix: 'success' })
      await expect(page.getByRole('button', { name: 'Add Phone Number' })).toHaveCount(0, { timeout: 15_000 })
      await centre(page, 'Plan')
      await shot(page, 'st-plan-badge', { suffix: 'pro-after-phone' })
    } finally {
      await context.close()
    }

    // The shell caches the User for a few minutes, so the status must be LAPSED before the first login.
    const lapsedEmail = 'rina.lapsed@example.com'
    await db.user.create({
      data: {
        email: lapsedEmail,
        authMethod: 'EMAIL',
        subscriptionStatus: 'LAPSED',
        onboardingTourCompletedAt: new Date(),
        profiles: { create: { name: 'Rina', relation: 'SELF', cycleLength: 28, periodLength: 5 } },
      },
    })
    const lapsedCtx = await browser.newContext({ ...testInfo.project.use, baseURL: URLS.web, extraHTTPHeaders: { 'x-real-ip': ipFor(lapsedEmail) } })
    try {
      const since = new Date(Date.now() - 1000)
      const sent = await lapsedCtx.request.post('/api/auth/magic-link/request', { data: { email: lapsedEmail } })
      expect(sent.ok()).toBe(true)
      const { callbackUrl } = await waitForMagicLinkEmail(lapsedEmail, { since })
      expect((await lapsedCtx.request.get(callbackUrl)).ok()).toBe(true)
      const page = await lapsedCtx.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/settings')
      await centre(page, 'Plan')
      await expect(page.getByText('Expired', { exact: true }).first()).toBeVisible()
      await shot(page, 'st-plan-badge', { suffix: 'expired' })
    } finally {
      await lapsedCtx.close()
    }
  })
})

test.describe('Navigation & Language', () => {
  test.use({ storageState: statePath('streaker') })

  test('bottom nav, More sheet, language switch and persistence', async ({ page }) => {
    await suppressAutoPrompts(page)
    await page.goto('/dashboard')
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
    await shot(page, 'nl-bottom-nav')

    await page.getByRole('button', { name: 'More' }).click()
    await expect(page.getByRole('heading', { name: 'More' })).toBeVisible()
    await shot(page, 'nl-more-sheet')

    await page.getByRole('button', { name: 'Switch language' }).click()
    await shot(page, 'nl-switch-language')
    await page.getByRole('button', { name: 'ভাষা পরিবর্তন করুন' }).click()
    await page.keyboard.press('Escape')

    // Switch from Settings, then reload: the choice is kept (cookie vesta_lang).
    await page.goto('/settings')
    await centre(page, 'Language & Appearance')
    await page.getByRole('radio', { name: 'বাং' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
    await shot(page, 'nl-switch-language', { suffix: 'settings' })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
    await shot(page, 'nl-language-persists')
    const cookie = (await page.context().cookies()).find((c) => c.name === 'vesta_lang')
    expect(cookie?.value).toBe('bn')
    await page.goto('/dashboard')
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
    await shot(page, 'nl-language-persists', { suffix: 'dashboard' })
  })

  // The desktop sidebar needs a wide viewport; the chapter's device is "phone", so the shot overrides it.
  test('desktop sidebar', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: URLS.web,
      storageState: statePath('streaker'),
      viewport: { width: 1366, height: 900 },
      timezoneId: 'Asia/Dhaka',
      locale: 'en-US',
    })
    try {
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/dashboard')
      await expect(page.getByRole('complementary', { name: 'Sidebar navigation' })).toBeVisible()
      await shot(page, 'nl-sidebar', { device: 'desktop' })
    } finally {
      await context.close()
    }
  })
})
