import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'

function parseStatNumber(text: string): number {
  const raw = text.trim().replace(/,/g, '')
  if (raw.endsWith('M')) return Math.round(parseFloat(raw) * 1_000_000)
  if (raw.endsWith('K')) return Math.round(parseFloat(raw) * 1_000)
  return Number(raw)
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

      const totalUsersText = () =>
        page.getByText('Total Users', { exact: true }).evaluate((el) => {
          const card = el.closest('div.rounded-2xl')
          return card?.querySelector('p.text-3xl')?.textContent?.trim() ?? ''
        })

      const before = parseStatNumber(await totalUsersText())
      expect(before).toBeGreaterThan(0)

      // Throwaway web users (real OTP) — never the seeded read-only personas.
      await newUser()
      await newUser()

      await page.getByRole('button', { name: 'Refresh data' }).click()
      await expect
        .poll(async () => parseStatNumber(await totalUsersText()), { timeout: 15_000 })
        .toBeGreaterThanOrEqual(before + 2)

      await expect(page.getByRole('heading', { name: 'New Signups' })).toBeVisible()
      await expect(page.getByText('Daily new user registrations — last 30 days')).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })
})
