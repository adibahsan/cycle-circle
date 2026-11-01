/**
 * Handbook chapter "SMS" (docs/handbook/chapters/sms.md), ticket #249.
 * as-otp uses a real fake-BDApps phone login and the Admin Logs page (OTP values are masked there).
 */
import { test, expect } from '../../../support/fixtures.ts'
import { ADMIN_STATE } from '../../support/admin-demo.ts'
import { seedDemoCampaign } from '../../support/automatic-demo.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })

test.describe('SMS', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoCampaign(db)
  })

  test('OTP in the merchant log', async ({ page, newUser }) => {
    await newUser()
    await page.goto('/logs?channel=merchant&text=subscription/otp')
    await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible()
    const line = page.locator('li').filter({ hasText: 'subscription/otp' }).first()
    await expect(line).toBeVisible({ timeout: 15_000 })
    await shot(page, 'as-otp')
  })

  test('campaign list', async ({ page }) => {
    await page.goto('/sms')
    await expect(page.getByText('Monsoon hygiene, 5 days')).toBeVisible()
    await page.getByPlaceholder('Search campaigns…').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'as-campaign-sms')
  })

  test('send time and delivery reports', async ({ page }) => {
    await page.goto('/system')
    const time = page.getByRole('heading', { name: 'SMS daily send time' })
    await time.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'as-send-time')
    const reports = page.getByRole('heading', { name: 'SMS delivery reports' })
    await reports.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'as-delivery-reports')
  })
})
