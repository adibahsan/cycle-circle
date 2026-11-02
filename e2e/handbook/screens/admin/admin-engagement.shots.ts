/**
 * Handbook chapter "Engagement" (docs/handbook/chapters/admin-engagement.md), ticket #246.
 * Seeded demo roster only.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'
import { seedAnalyticsHistory } from './analytics-demo.ts'

test.use({ storageState: ADMIN_STATE })

test.describe('Admin Engagement', () => {
  test.beforeAll(async ({ db }) => {
    await seedAnalyticsHistory(db)
  })

  test('Active user definition and the panels', async ({ page }) => {
    await page.goto('/engagement')
    await expect(page.getByRole('heading', { name: 'Engagement', exact: true })).toBeVisible()
    await refreshData(page)
    await expect(page.getByRole('heading', { name: 'Daily Active Users', exact: true })).toBeVisible()
    await expect(page.getByText(/Daily Active Users counts users who opened the app/)).toBeVisible()
    await shot(page, 'en-active')

    await page.getByRole('heading', { name: 'Logging Streak Distribution' }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await expect(page.getByRole('heading', { name: 'Weekly Logging Retention' })).toBeVisible()
    await page.mouse.move(0, 0)
    await shot(page, 'en-panels')
  })
})
