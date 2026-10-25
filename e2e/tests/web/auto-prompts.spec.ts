/**
 * W18 — auto-prompt arbiter: one prompt at a time, priority order (#133 closes the #122 look-only gap).
 * Seeds real DB state (no API mocks). Priority: trial-lock > late-alert > tour > check-in > profile.
 */
import { test, expect } from '../../support/fixtures.ts'
import { db, ensureUserProfile, setPeriodLogs } from '../../support/db.ts'
import { createEmailTrialUser } from '../../support/users.ts'

const visibleDialogs = (page: import('@playwright/test').Page) =>
  page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible')

test.describe('auto-prompt arbiter (W18)', () => {
  test('when late-alert and check-in are both eligible, only the late alert shows', async ({ newUser, days }) => {
    // Priority: late-alert > check-in. Fresh profile has not checked in today, so check-in is also a candidate.
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Arbiter Late',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.startOf(days.daysAgo(40)),
    })
    await setPeriodLogs(profile.id, [
      { startDate: days.startOf(days.daysAgo(40)), endDate: days.startOf(days.daysAgo(36)) },
    ])

    await page.goto('/dashboard')
    await expect(page.locator('[aria-labelledby="late-alert-title"]')).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(1500)
    await expect(visibleDialogs(page)).toHaveCount(1)
    await expect(page.locator('[aria-labelledby="late-alert-title"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: /How are you feeling|আজ কেমন/i })).toHaveCount(0)
  })

  test('closing the late alert does not open a lower-priority prompt in the same visit', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Arbiter Dismiss',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.startOf(days.daysAgo(40)),
    })
    await setPeriodLogs(profile.id, [
      { startDate: days.startOf(days.daysAgo(40)), endDate: days.startOf(days.daysAgo(36)) },
    ])

    await page.goto('/dashboard')
    await expect(page.locator('[aria-labelledby="late-alert-title"]')).toBeVisible({ timeout: 20_000 })
    await page.keyboard.press('Escape')
    await expect(visibleDialogs(page)).toHaveCount(0)
    await page.waitForTimeout(1500)
    await expect(visibleDialogs(page)).toHaveCount(0)
  })

  test('expired email trial: only the trial lock is visible', async ({ browser }) => {
    const { context, email } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()
    try {
      await db.user.update({
        where: { email },
        data: { emailTrialExpiresAt: new Date(Date.now() - 60_000), onboardingTourCompletedAt: new Date() },
      })
      await page.goto('/dashboard')
      const lock = page.locator('[aria-labelledby="trial-expired-title"]')
      await expect(lock).toBeVisible({ timeout: 20_000 })
      await page.waitForTimeout(1500)
      await expect(visibleDialogs(page)).toHaveCount(1)
      await expect(lock).toBeVisible()
    } finally {
      await context.close()
    }
  })
})
