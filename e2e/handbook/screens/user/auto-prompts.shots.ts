/**
 * Handbook chapter "Auto-prompts" (docs/handbook/chapters/auto-prompts.md), ticket #242.
 * Every scenario is a throwaway demo User (fake name Rina or Sultana) made through the real login flow.
 * Nothing here calls suppressAutoPrompts: the prompts are the subject.
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../../support/fixtures.ts'
import { setupProfile } from '../../../support/profiles.ts'
import { toDbPhone } from '../../../support/users.ts'
import { demoEmailTrialUser } from '../../support/demo-users.ts'
import { shot } from '../../support/shot.ts'

const lateAlert = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Your period is running late' })
const tour = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Welcome to Cycle Circle' })
const checkIn = (page: Page) => page.getByRole('dialog').filter({ hasText: 'How are you feeling today?' })

test.describe('Auto-prompts', () => {
  test('one prompt per page load: late alert, then tour, then check-in', async ({ newUser, days }) => {
    const { page } = await newUser()
    // Late period + tour not finished + nothing logged today: three prompts want the first page load.
    await setupProfile(page, { name: 'Rina', lastPeriodStart: days.daysAgo(33), skipTour: false })
    await page.goto('/dashboard')
    await expect(lateAlert(page)).toBeVisible()
    await expect(tour(page)).toHaveCount(0)
    await shot(page, 'ap-rule')

    await page.getByRole('button', { name: 'Maybe later' }).click()
    await expect(lateAlert(page)).toHaveCount(0)
    // Settled signal: the dashboard has rendered its content, so a prompt that was going to open would have by now.
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(tour(page)).toHaveCount(0)
    await expect(checkIn(page)).toHaveCount(0)
    await shot(page, 'ap-rule', { suffix: 'after-close' })

    await page.reload()
    await expect(tour(page)).toBeVisible()
    await expect(lateAlert(page)).toHaveCount(0)
    await shot(page, 'ap-rule', { suffix: 'second-load' })
    await page.getByRole('button', { name: 'Skip' }).click()

    await page.reload()
    await expect(checkIn(page)).toBeVisible()
    await shot(page, 'ap-rule', { suffix: 'third-load' })
  })

  test('late-period alert', async ({ newUser, days }) => {
    const { page } = await newUser()
    await setupProfile(page, { name: 'Rina', lastPeriodStart: days.daysAgo(33) })
    await page.goto('/dashboard')
    await expect(lateAlert(page)).toBeVisible()
    await shot(page, 'ap-late-period')
    await page.getByRole('button', { name: 'Log my period' }).click()
    await expect(page.getByRole('dialog').filter({ hasText: /period/i }).first()).toBeVisible()
    await shot(page, 'ap-late-period', { suffix: 'log-period' })
  })

  test('onboarding tour prompt', async ({ newUser, days }) => {
    const { page } = await newUser()
    await setupProfile(page, { name: 'Rina', lastPeriodStart: days.daysAgo(10), skipTour: false })
    await page.goto('/dashboard')
    await expect(tour(page)).toBeVisible()
    await shot(page, 'ap-tour')
  })

  test('check-in prompt', async ({ newUser, days }) => {
    const { page } = await newUser()
    await setupProfile(page, { name: 'Rina', lastPeriodStart: days.daysAgo(10) })
    await page.goto('/dashboard')
    await expect(checkIn(page)).toBeVisible()
    await shot(page, 'ap-checkin')
  })

  test('profile-completion prompt', async ({ newUser, db }) => {
    const { page, phone } = await newUser()
    await setupProfile(page, { name: 'Sultana' })
    await db.user.update({ where: { phone: toDbPhone(phone) }, data: { createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) } })
    await page.clock.install()
    await page.goto('/calendar')
    await expect(page.getByRole('heading', { name: 'Calendar' }).first()).toBeVisible()
    await page.clock.runFor(61_000)
    const modal = page.getByRole('dialog').filter({ hasText: 'Complete Your Profile' })
    await expect(modal).toBeVisible()
    await shot(page, 'ap-completion')
  })

  test('trial lock', async ({ browser }, testInfo) => {
    const context = await demoEmailTrialUser(browser, testInfo.project.use, 'rina.lock@example.com')
    try {
      const { db } = await import('../../../support/db.ts')
      await db.user.update({ where: { email: 'rina.lock@example.com' }, data: { emailTrialExpiresAt: new Date(Date.now() - 60 * 60 * 1000) } })
      const page = await context.newPage()
      await page.goto('/dashboard')
      const lock = page.getByRole('dialog').filter({ hasText: 'Your 24-hour trial has ended' })
      await expect(lock).toBeVisible()
      await shot(page, 'ap-trial-lock')
      await lock.getByRole('link', { name: 'Upgrade to Pro' }).click()
      await expect(page).toHaveURL(/\/subscription/)
      await expect(page.getByRole('dialog').filter({ hasText: 'Your 24-hour trial has ended' })).toHaveCount(0)
    } finally {
      await context.close()
    }
  })
})
