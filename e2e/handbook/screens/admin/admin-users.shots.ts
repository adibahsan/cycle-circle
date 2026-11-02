/**
 * Handbook chapter "Users" (docs/handbook/chapters/admin-users.md), ticket #245.
 * Read-only screens use the seeded Admin and the demo roster; every action shot works on a
 * disposable demo member (`freshDemoMember`), never on a seeded persona.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE, DEMO_FIRST, freshDemoMember, seedDemoMembers } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })

test.describe('Admin Users: list, search, export, detail', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
  })

  test('list, search and filters', async ({ page }) => {
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible()
    await refreshData(page) // the list is cached for minutes; another file may have cached it before seeding
    await expect(page.getByRole('button', { name: /Nusrat Jahan/ })).toBeVisible()
    await shot(page, 'us-list', { suffix: 'charts' })

    // Oldest first, so the table shows the demo Users and not the accounts other capture files create "now".
    await page.goto('/users?sort=createdAt&order=asc')
    await refreshData(page)
    const search = page.getByPlaceholder('Search by name, email, or phone…')
    await expect(page.getByRole('button', { name: /Sumaiya Hoque/ })).toBeVisible()
    await search.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'us-list')

    await page.goto('/users')
    await search.fill('Tasnim')
    await expect(page).toHaveURL(/search=Tasnim/)
    await expect(page.getByRole('button', { name: /Tasnim Sultana/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Nusrat Jahan/ })).toHaveCount(0)
    await search.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'us-search-filters', { suffix: 'search' })

    // Phones are stored as +8801711000101; search is a plain substring match on that text.
    await search.fill('01711000101')
    await expect(page.getByRole('button', { name: /Tasnim Sultana/ })).toBeVisible()
    await search.fill('0171 1000101')
    await expect(page.getByText('No users match your filters.')).toBeVisible()
    await search.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'us-search-filters', { suffix: 'no-match' })

    await page.goto('/users?status=suspended')
    await refreshData(page)
    await expect(page.getByRole('button', { name: /Halima Khatun/ })).toBeVisible()
    await page.getByPlaceholder('Search by name, email, or phone…').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'us-search-filters')
  })

  test('CSV export', async ({ page }) => {
    await page.goto('/users')
    const button = page.getByRole('button', { name: 'Export CSV' })
    await expect(button).toBeVisible()
    const download = page.waitForEvent('download')
    await button.click()
    expect((await download).suggestedFilename()).toMatch(/^users-\d{4}-\d{2}-\d{2}\.csv$/)
    await shot(page, 'us-export', { of: page.locator('main > div > div').first() })
  })

  test('user detail and plan history', async ({ page }) => {
    await page.goto(`/users/${DEMO_FIRST.id}`)
    await expect(page.getByRole('heading', { name: DEMO_FIRST.name, exact: true })).toBeVisible()
    await expect(page.getByText('Maliha')).toBeVisible()
    await shot(page, 'us-detail')

    await page.getByRole('tab', { name: 'Subscription' }).click()
    await expect(page.getByText('Current Subscription')).toBeVisible()
    await shot(page, 'us-detail', { suffix: 'subscription' })
  })

  test('notification preferences and reminders', async ({ page, db }) => {
    const m = await freshDemoMember(db, 'notif', 'Ayesha Siddika', 11)
    await page.goto(`/users/${m.id}`)
    await expect(page.getByRole('heading', { name: m.name, exact: true })).toBeVisible()
    const toggle = page.getByRole('switch', { name: 'Fertile window' })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(toggle).toBeEnabled()
    await shot(page, 'us-notif-prefs')

    await page.getByRole('button', { name: 'Send reminder emails now' }).click()
    await expect(page.getByText(/reminder email|No reminders are currently due/).first()).toBeVisible()
    await shot(page, 'us-reminders')
  })
})

test.describe('Admin Users: actions on a disposable member', () => {
  test('suspend and reactivate', async ({ page, db }) => {
    const m = await freshDemoMember(db, 'suspend', 'Rehana Parvin', 12)
    await page.goto(`/users/${m.id}`)
    await expect(page.getByRole('heading', { name: m.name, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Suspend', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/Reason \(required/).fill('Repeated abusive feedback messages')
    await shot(page, 'us-suspend', { suffix: 'confirm' })
    await dialog.getByRole('button', { name: 'Suspend', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText(/Suspended on/)).toBeVisible()
    await shot(page, 'us-suspend')

    await page.getByRole('button', { name: 'Reactivate' }).click()
    await shot(page, 'us-suspend', { suffix: 'reactivate-confirm' })
    await page.getByRole('dialog').getByRole('button', { name: 'Reactivate', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Suspend', exact: true })).toBeVisible()
  })

  test('delete and restore', async ({ page, db }) => {
    const m = await freshDemoMember(db, 'delete', 'Sharmin Akter', 13)
    await page.goto(`/users/${m.id}`)
    await expect(page.getByRole('heading', { name: m.name, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await shot(page, 'us-delete-restore', { suffix: 'confirm' })
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()
    await shot(page, 'us-delete-restore')
    await page.getByRole('button', { name: 'Restore' }).click()
    await shot(page, 'us-delete-restore', { suffix: 'restore-confirm' })
    await page.getByRole('dialog').getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible()
  })

  test('set subscription status (grant and revoke Pro)', async ({ page, db }) => {
    const m = await freshDemoMember(db, 'status', 'Mehnaz Kabir', 14)
    await page.goto(`/users/${m.id}`)
    await expect(page.getByRole('heading', { name: m.name, exact: true })).toBeVisible()
    const topCard = page.getByRole('heading', { name: m.name, exact: true }).locator('xpath=ancestor::div[contains(@class,"glass")][1]')
    await shot(page, 'us-set-status', { of: topCard })

    await page.getByLabel('Set subscription status').click()
    await page.getByRole('option', { name: 'Free' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, 'us-set-status', { suffix: 'confirm' })
    await page.getByRole('dialog').getByRole('button', { name: 'Set FREE' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Subscription' }).click()
    await expect(page.getByText('Admin Override')).toBeVisible()
    await shot(page, 'us-pro-override')

    await page.getByRole('tab', { name: 'Plan history' }).click()
    await expect(page.getByRole('tabpanel').getByRole('listitem').first()).toBeVisible({ timeout: 15_000 })
    await shot(page, 'us-history')
  })
})
