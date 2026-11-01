/**
 * Handbook chapter "Getting started" (docs/handbook/chapters/getting-started.md), ticket #239.
 * Anchors and file names come from docs/handbook/OUTLINE.md; `shot()` refuses anything else.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { demoEmailTrialUser, demoPhoneUser, DEMO_PHONES } from '../../support/demo-users.ts'
import { shot } from '../../support/shot.ts'

test.describe('Getting started', () => {
  test('public pages: Welcome, Get Started, Terms, Privacy', async ({ page }) => {
    await page.goto('/welcome')
    await expect(page.getByRole('heading', { name: 'Your cycle, understood' })).toBeVisible()
    await shot(page, 'gs-welcome')
    await page.getByRole('heading', { name: 'Everything you need to understand your body' }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'gs-welcome', { suffix: 'features' })

    await page.goto('/get-started')
    await expect(page.getByRole('heading', { name: 'Track with ease' })).toBeVisible()
    await shot(page, 'gs-get-started')
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Ready to begin?' })).toBeVisible()
    await shot(page, 'gs-get-started', { suffix: 'final' })

    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: 'Terms & Conditions' }).first()).toBeVisible()
    await shot(page, 'gs-terms')

    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Privacy Policy' }).first()).toBeVisible()
    await shot(page, 'gs-privacy')
  })

  test('phone login: number, BDApps OTP, resend wait and errors', async ({ page, fakeBdapps }) => {
    const phone = DEMO_PHONES.loginFlow
    await page.goto('/login')
    await expect(page.getByLabel('Phone Number')).toBeVisible()
    await shot(page, 'gs-phone-login')

    await page.getByLabel('Phone Number').fill('0171')
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page.getByText('Enter a valid 11-digit Bangladesh number')).toBeVisible()
    await shot(page, 'gs-phone-login', { suffix: 'invalid-number' })

    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page).toHaveURL(/\/verify-otp/)
    await expect(page.getByText(/Resend in \d+s/)).toBeVisible()
    await shot(page, 'gs-phone-login', { suffix: 'enter-code' })
    await shot(page, 'gs-otp-resend')

    const otp = await fakeBdapps.latestOtp(phone)
    const wrong = otp.code === '000000' ? '999999' : '000000'
    await page.getByRole('textbox', { name: 'Digit 1' }).fill(wrong)
    await expect(page.getByRole('alert').filter({ hasText: /Invalid or expired code/ })).toBeVisible()
    await shot(page, 'gs-otp-resend', { suffix: 'wrong-code' })
  })

  test('email login: magic link, sent state and trial', async ({ page, browser }, testInfo) => {
    await page.goto('/email-login')
    await expect(page.getByRole('heading', { name: 'Email login' })).toBeVisible()
    await shot(page, 'gs-email-login')

    await page.getByLabel('Email address').fill('rina.demo@example.com')
    await page.getByRole('button', { name: 'Send Magic Link' }).click()
    await expect(page.getByRole('heading', { name: 'Check your inbox!' })).toBeVisible()
    await shot(page, 'gs-email-login', { suffix: 'sent' })

    await page.goto('/email-login?error=TOKEN_EXPIRED')
    await expect(page.getByText('This sign-in link has expired. Enter your email below to get a new one.')).toBeVisible()
    await shot(page, 'gs-email-login', { suffix: 'expired-link' })

    const context = await demoEmailTrialUser(browser, testInfo.project.use, 'rina.trial@example.com')
    try {
      const trial = await context.newPage()
      await suppressAutoPrompts(trial)
      await trial.goto('/dashboard')
      await expect(trial.getByRole('button', { name: /Trial ends in/ }).filter({ visible: true }).first()).toBeVisible()
      await shot(trial, 'gs-email-trial')
    } finally {
      await context.close()
    }
  })

  test('onboarding, tour and replay', async ({ browser, days }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, DEMO_PHONES.onboarding)
    try {
      const page = await context.newPage()
      await page.goto('/onboarding')
      await expect(page.getByRole('heading', { name: 'Welcome to Cycle Circle' })).toBeVisible()
      await shot(page, 'gs-onboarding')

      await page.getByRole('button', { name: 'Get Started' }).click()
      await expect(page.getByRole('heading', { name: 'What is your goal?' })).toBeVisible()
      await page.getByRole('button', { name: /Period Tracking/i }).click()
      await shot(page, 'gs-onboarding', { suffix: 'goal' })
      await page.getByRole('button', { name: 'Next' }).click()

      await expect(page.getByRole('heading', { name: 'Who is this profile for?' })).toBeVisible()
      await page.getByLabel(/Name \*/i).fill('Rina')
      await shot(page, 'gs-onboarding', { suffix: 'profile' })
      await page.getByRole('button', { name: 'Next' }).click()

      await expect(page.getByRole('heading', { name: 'Tell us about your cycle' })).toBeVisible()
      await page.getByLabel(/Last period start date \*/i).fill(days.daysAgo(10))
      await shot(page, 'gs-onboarding', { suffix: 'cycle' })
      await page.getByRole('button', { name: 'Next' }).click()

      await expect(page.getByRole('heading', { name: "You're all set!" })).toBeVisible()
      await shot(page, 'gs-onboarding', { suffix: 'summary' })
      await page.getByRole('button', { name: 'Go to Dashboard' }).click()

      // The first-run tour opens by itself on the dashboard.
      const tour = page.getByRole('dialog').filter({ hasText: 'Welcome to Cycle Circle' })
      await expect(tour).toBeVisible()
      await shot(page, 'gs-tour')
      const steps = [
        ['Log your period', 'log'],
        ['Your cycle calendar', 'calendar'],
        ['Personal insights', 'insights'],
        ['Finish your profile', 'profile'],
      ] as const
      for (const [title, suffix] of steps) {
        await page.getByRole('button', { name: 'Next' }).click()
        await expect(page.getByText(title, { exact: true })).toBeVisible()
        await shot(page, 'gs-tour', { suffix })
      }
      await page.getByRole('button', { name: 'Done' }).click()
      await expect(tour).not.toBeVisible()

      // Replay: Settings > "Replay app tour".
      await suppressAutoPrompts(page)
      await page.goto('/settings')
      const replay = page.getByRole('button', { name: /Replay app tour/ })
      await replay.scrollIntoViewIfNeeded()
      await shot(page, 'gs-tour-replay')
      await replay.click()
      await expect(page.getByRole('dialog').filter({ hasText: 'Welcome to Cycle Circle' })).toBeVisible()
      await shot(page, 'gs-tour-replay', { suffix: 'tour-reopened' })
    } finally {
      await context.close()
    }
  })
})
