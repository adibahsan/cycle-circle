/**
 * Handbook chapter "Scheduled jobs" (docs/handbook/chapters/scheduled-jobs.md), ticket #249.
 * Read-only: seeded Admin, seeded demo members and one demo SMS campaign. Nothing is run.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { seedDemoCampaign } from '../../support/automatic-demo.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })

test.describe('Scheduled jobs', () => {
  let campaignId = ''
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
    campaignId = await seedDemoCampaign(db)
  })

  test('System page: switches, schedules, history, reports', async ({ page, db }) => {
    await page.goto('/system')
    await expect(page.getByRole('heading', { name: 'System', exact: true })).toBeVisible()
    await shot(page, 'sj-overview')

    await page.getByRole('button', { name: 'Run Daily reminders cron job now' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, 'sj-daily-reminders')
    await page.getByRole('button', { name: 'Cancel' }).click()

    const history = page.getByRole('heading', { name: 'Daily subscription check history' })
    await history.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await expect(page.getByTestId('run-history')).toBeVisible()
    await shot(page, 'sj-sub-check')

    await db.systemSetting.upsert({
      where: { key: 'reports.recipients' }, create: { key: 'reports.recipients', value: 'owner@example.test,ops@example.test' },
      update: { value: 'owner@example.test,ops@example.test' },
    })
    await page.reload()
    const reports = page.getByRole('heading', { name: 'Emailed reports' })
    await reports.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await expect(page.getByLabel(/^Recipients/)).toHaveValue(/owner@example.test/)
    await shot(page, 'sj-reports')
    await db.systemSetting.delete({ where: { key: 'reports.recipients' } })
  })

  test('campaign dispatch result', async ({ page }) => {
    await page.goto(`/sms/${campaignId}`)
    await expect(page.getByRole('heading', { name: 'Monsoon hygiene, 5 days' })).toBeVisible()
    await shot(page, 'sj-sms-dispatch')
  })

  test('deleted accounts waiting for the purge', async ({ page }) => {
    await page.goto('/users?status=deleted')
    await refreshData(page)
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible()
    const search = page.getByPlaceholder('Search by name, email, or phone…')
    await search.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'sj-nightly')
  })
})
