import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'

/** Mirrors DashboardClient.formatNumber — build expected display; never parse UI as the source of truth. */
function formatStatDisplay(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

/**
 * StatCard value sits in the `<p>` after the title row.
 * No role/name or data-testid on the value (a11y gap #135).
 */
async function readStatCardValue(page: Page, title: string): Promise<string> {
  return page.getByText(title, { exact: true }).evaluate((titleEl) => {
    const titleRow = titleEl.parentElement
    const valueEl = titleRow?.nextElementSibling
    if (valueEl && valueEl.tagName === 'P') return valueEl.textContent?.trim() ?? ''
    const card = titleEl.parentElement?.parentElement
    if (!card) return ''
    const paragraphs = Array.from(card.querySelectorAll('p'))
    return paragraphs.find((p) => p !== titleEl)?.textContent?.trim() ?? ''
  })
}

/** Today's signup bucket using the same UTC day key as getUserTrend. */
async function todaySignupBucketCount(): Promise<number> {
  const todayKey = new Date().toISOString().split('T')[0]
  const start = new Date(`${todayKey}T00:00:00.000Z`)
  const end = new Date(`${todayKey}T23:59:59.999Z`)
  return e2eDb().user.count({
    where: { deletedAt: null, createdAt: { gte: start, lte: end } },
  })
}

test.describe('Admin dashboard', () => {
  test('KPIs and the signup trend reflect users created in the run', async ({
    browser,
    newUser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })
    const { page } = admin

    try {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
      await page.getByRole('button', { name: 'Refresh data' }).click()

      const beforeText = await readStatCardValue(page, 'Total Users')
      expect(beforeText.length).toBeGreaterThan(0)
      const beforeToday = await todaySignupBucketCount()

      // Throwaway web users (real OTP) — never the seeded read-only personas.
      await newUser()
      await newUser()

      const afterToday = await todaySignupBucketCount()
      expect(afterToday).toBeGreaterThanOrEqual(beforeToday + 2)

      // Parallel workers may add more users; refresh until display matches the live DB count
      // (exact formatted string — no "1.2K" reverse-parsing).
      await expect
        .poll(
          async () => {
            await page.getByRole('button', { name: 'Refresh data' }).click()
            const dbTotal = await e2eDb().user.count({ where: { deletedAt: null } })
            const ui = await readStatCardValue(page, 'Total Users')
            return ui === formatStatDisplay(dbTotal) && ui !== beforeText
          },
          { timeout: 20_000 },
        )
        .toBe(true)

      await expect(page.getByRole('heading', { name: 'New Signups' })).toBeVisible()
      await expect(page.getByText('Daily new user registrations — last 30 days')).toBeVisible()
      // Recharts AreaChart exposes no accessible per-day counts (#135); today's bucket is
      // asserted via the same User.createdAt day grouping the chart reads (see COVERAGE.md A02).
      expect(afterToday - beforeToday).toBeGreaterThanOrEqual(2)
    } finally {
      await admin.context.close()
    }
  })
})
