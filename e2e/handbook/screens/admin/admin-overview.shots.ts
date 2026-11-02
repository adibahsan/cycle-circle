/**
 * Handbook chapter "Overview" (docs/handbook/chapters/admin-overview.md), ticket #245.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })

test.describe('Admin Overview', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
  })

  test('KPI cards, churn table and charts', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    await refreshData(page) // another file may have cached the page before the demo data landed
    await expect(page.getByText('Total Users', { exact: true })).toBeVisible()
    await expect(page.getByText('Estimated Daily Revenue', { exact: true })).toBeVisible()
    await shot(page, 'ov-kpis')

    await page.getByRole('heading', { name: 'Churn by reason' }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await expect(page.getByRole('row', { name: /BDApps unsubscribe/ })).toBeVisible()
    await shot(page, 'ov-kpis', { suffix: 'churn', of: page.locator('section[aria-label="Churn by reason"]') })

    await page.getByRole('button', { name: '7d' }).click()
    await expect(page).toHaveURL(/range=7d/)
    await expect(page.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')
    await page.evaluate(() => window.scrollTo(0, 0))
    await shot(page, 'ov-kpis', { suffix: 'range-7d' })
  })

  test('signup trend chart', async ({ page }) => {
    await page.goto('/')
    const heading = page.getByRole('heading', { name: 'New Signups', exact: true })
    await expect(heading).toBeVisible()
    await refreshData(page)
    await heading.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await expect(page.getByRole('img').or(page.locator('.recharts-surface')).first()).toBeVisible()
    await shot(page, 'ov-signup-trend')
  })
})
