import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { openChartTable, refreshData, type AdminBrowserOpts } from '../../support/admin-charts'

// Ticket 206 (spec #192): a persona opening the web app is one more active user today.

async function todayActiveUsers(page: Page, today: string): Promise<number> {
  await refreshData(page)
  const table = await openChartTable(page, 'Daily Active Users')
  const row = table.getByRole('row', { name: new RegExp(`^${today}\\b`) })
  await expect(row).toBeVisible()
  return Number.parseInt(((await row.getByRole('cell').first().textContent()) ?? '').trim(), 10)
}

test.describe('Admin active users', () => {
  test('a persona opening the web app adds one active user today', async ({
    browser,
    newUser,
    days,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const opts: AdminBrowserOpts = { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId }
    const admin = await createLoggedInAdmin(browser, opts)
    try {
      const page = admin.page
      await page.goto('/engagement?range=7d')
      await expect(page.getByText('Active-user history starts on the day recording began')).toBeVisible()
      const before = await todayActiveUsers(page, days.today)

      const persona = await newUser()
      await persona.page.goto('/dashboard')
      await expect(persona.page).toHaveURL(/\/dashboard/)

      // Other workers open the app too, so "one more" is a lower bound on a shared DB.
      await expect
        .poll(() => todayActiveUsers(page, days.today), { timeout: 30_000 })
        .toBeGreaterThanOrEqual(before + 1)
    } finally {
      await admin.context.close()
    }
  })
})
