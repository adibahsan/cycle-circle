/**
 * Handbook chapter "Subscriptions" (docs/handbook/chapters/admin-subscriptions.md), ticket #245.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })

test.describe('Admin Subscriptions', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
  })

  test('list, check strip and row actions', async ({ page }) => {
    await page.goto('/subscriptions')
    await expect(page.getByRole('heading', { name: 'Subscriptions', exact: true })).toBeVisible()
    await refreshData(page)
    await expect(page.getByRole('row', { name: /Nusrat Jahan/ })).toBeVisible()
    await expect(page.getByTestId('check-strip')).toHaveAttribute('data-state', 'ok')
    await shot(page, 'su-list')

    await page.getByText('Status:').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'su-list', { suffix: 'table' })

    await page.getByRole('button', { name: 'Revoke', exact: true }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, 'su-list', { suffix: 'revoke-confirm' })
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('status filter', async ({ page }) => {
    await page.goto('/subscriptions?status=LAPSED')
    await refreshData(page)
    await expect(page.getByRole('row', { name: /Kaniz Fatema/ })).toBeVisible()
    await page.getByText('Status:').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'su-filter')
  })
})
