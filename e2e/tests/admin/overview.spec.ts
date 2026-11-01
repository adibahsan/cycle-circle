import type { Download } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { refreshData } from '../../support/admin-charts'
import { e2eDb } from '../../support/db'

// Fixture days sit in 2021, which no other E2E spec uses. Pro prices, Pro snapshots and churn
// events are global tables, so the rows are cleared before and after.
const Y21 = { gte: new Date('2021-01-01'), lt: new Date('2022-01-01') }

async function clearFixtures() {
  const db = e2eDb()
  await db.churnEvent.deleteMany({ where: { occurredAt: Y21 } })
  await db.proSnapshot.deleteMany({ where: { day: Y21 } })
  await db.proPrice.deleteMany({ where: { effectiveFrom: Y21 } })
}

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('download stream missing')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

test.describe('Admin overview numbers', () => {
  test('shows estimated revenue across a price change, churn by reason, and unavailable days', async ({
    browser, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId,
  }, testInfo) => {
    // Pro prices, snapshots and churn events are global: desktop and phone must not write them at once.
    test.skip(testInfo.project.name !== 'admin-desktop', 'desktop owns the global fixture rows')
    await clearFixtures()
    const db = e2eDb()
    // 5 a day from February; from 2 March 70 a week (10 a day).
    await db.proPrice.create({ data: { amount: 5, period: 'DAILY', effectiveFrom: new Date('2021-02-01') } })
    await db.proPrice.create({ data: { amount: 70, period: 'WEEKLY', effectiveFrom: new Date('2021-03-02') } })
    // Range 1-3 March; 3 March has no snapshot. Previous period 26-28 February; 26 Feb has none.
    for (const [day, proCount] of [['2021-02-27', 2], ['2021-02-28', 2], ['2021-03-01', 3], ['2021-03-02', 3]] as const) {
      await db.proSnapshot.create({ data: { day: new Date(day), proCount } })
    }
    await db.churnEvent.create({ data: { reason: 'ADMIN_REVOKE', occurredAt: new Date('2021-03-01T05:00:00Z') } })
    await db.churnEvent.create({ data: { reason: 'DAILY_CHECK', occurredAt: new Date('2021-03-01T06:00:00Z') } })

    const admin = await createLoggedInAdmin(browser, { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId })
    try {
      const { page } = admin
      await page.goto('/?from=2021-03-01&to=2021-03-03')
      await refreshData(page)
      const card = (title: string) => page.getByRole('group', { name: title, exact: true })

      // 1 March 3 x 5 + 2 March 3 x 10 = 45 over two available days, 22.5 a day; previous 2 x 2 x 5 = 20 over two days, 10 a day.
      await expect(card('Estimated Daily Revenue').getByRole('paragraph').first()).toHaveText('৳22.5')
      await expect(card('Estimated Daily Revenue').getByText('৳45 in total')).toBeVisible()
      await expect(card('Estimated Daily Revenue').getByText('+125% vs previous period')).toBeVisible()
      await expect(page.getByText('1 of 3 days have no Pro subscriber count')).toBeVisible()
      await expect(page.getByText('not billed money')).toBeVisible()

      // 3 March has no snapshot and is not today: unavailable, not 0.
      await expect(card('Pro Subscribers').getByRole('paragraph')).toHaveText('Unavailable')
      // 1 churned (the admin revoke is left out) of the 2 Pro on 28 February.
      await expect(card('Churn Rate').getByRole('paragraph')).toHaveText('50%')

      const revoke = page.getByRole('row', { name: /^Admin revoke/ })
      await expect(revoke.getByRole('cell').first()).toHaveText('1')
      await expect(revoke).toContainText('not counted in the churn rate')
      await expect(page.getByRole('row', { name: /^Daily subscription check/ }).getByRole('cell').first()).toHaveText('1')

      // The churn table exports CSV for the range.
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export Churn by reason as CSV', exact: true }).dispatchEvent('click'),
      ])
      expect(download.suggestedFilename()).toBe('churn-by-reason_2021-03-01_2021-03-03.csv')
      const csv = await downloadText(download)
      expect(csv).toContain('Admin revoke,1,0,,no')
      expect(csv).toContain('Daily subscription check,1,0,,yes')
    } finally {
      await admin.context.close()
      await clearFixtures()
    }
  })

  test('the Overview range is kept in the URL and refused past 366 days', async ({
    browser, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId,
  }) => {
    const admin = await createLoggedInAdmin(browser, { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId })
    try {
      const { page } = admin
      await page.goto('/?from=2021-03-01&to=2021-03-10')
      await expect(page.getByText('2021-03-01 to 2021-03-10 (Bangladesh days)')).toBeVisible()
      await expect(page.getByText('Every number is compared with the previous 10 days')).toBeVisible()
      await page.reload()
      await expect(page.getByText('2021-03-01 to 2021-03-10 (Bangladesh days)')).toBeVisible()

      await page.goto('/?from=2019-01-01&to=2021-03-10')
      await expect(page.getByRole('alert').filter({ hasText: 'Pick a range of 366 days or fewer.' })).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })
})
