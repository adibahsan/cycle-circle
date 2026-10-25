import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { createEmailTrialUser } from '../../support/users'

async function expectEmailsFilterUrl(
  page: import('@playwright/test').Page,
  opts: { search?: string; type?: string },
) {
  await expect(page).toHaveURL((url) => {
    const params = url.searchParams
    if (opts.search !== undefined && params.get('search') !== opts.search) return false
    if (opts.type !== undefined && params.get('type') !== opts.type) return false
    return true
  })
}

test.describe('Admin emails', () => {
  test('the email log lists emails sent in the run and opens email detail', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const { email, context: userContext } = await createEmailTrialUser(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    try {
      const { page } = admin
      await page.goto('/emails?pageSize=100')
      await expect(page.getByRole('heading', { name: 'Email Logs' })).toBeVisible()

      // Debounced search for the throwaway user's email
      await page.getByRole('searchbox', { name: 'Search' }).fill(email)
      await expectEmailsFilterUrl(page, { search: email })

      const emailRow = page.getByText(email, { exact: true })
      await expect(emailRow).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('table').getByText('Magic Link')).toBeVisible()

      // Click row to view email detail
      await emailRow.click()
      await expect(page).toHaveURL(/\/emails\/[a-z0-9]+/)
      await expect(page.getByRole('heading', { name: 'Email Preview' })).toBeVisible()
      await expect(page.getByText(email, { exact: true })).toBeVisible()
      await expect(page.getByText('SENT', { exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Back to email logs' })).toBeVisible()
    } finally {
      await admin.context.close()
      await userContext.close()
    }
  })

  test('template previews render in English and Bengali', async ({
    browser,
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

    try {
      const { page } = admin
      await page.goto('/emails/preview')
      await expect(page.getByRole('heading', { name: 'Email Preview' })).toBeVisible()

      // Default: Period Alert, English
      const frame = page.frameLocator('iframe[title*="Email preview"]')
      await expect(frame.getByText('Period Prediction')).toBeVisible({ timeout: 15_000 })

      // Switch to Bengali
      await page.getByRole('button', { name: 'BN', exact: true }).click()
      await expect(frame.getByText('পিরিয়ড পূর্বাভাস')).toBeVisible({ timeout: 15_000 })

      // Switch template to Fertile Window (Bengali remains active)
      await page.getByLabel('Template').selectOption({ label: 'Fertile Window' })
      await expect(frame.getByText('উর্বর সময় শুরু হয়েছে')).toBeVisible({ timeout: 15_000 })

      // Switch to English
      await page.getByRole('button', { name: 'EN', exact: true }).click()
      await expect(frame.getByText('Fertile Window Begins')).toBeVisible({ timeout: 15_000 })
    } finally {
      await admin.context.close()
    }
  })
})
