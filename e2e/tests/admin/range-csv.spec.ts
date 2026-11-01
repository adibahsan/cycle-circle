import { randomBytes } from 'node:crypto'
import type { Download, Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb, setUserSubscription } from '../../support/db'
import { toDbPhone } from '../../support/users'

const BOM = '﻿'

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('download stream missing')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

/** Click an export button and read the file. dispatchEvent: charts keep re-laying out on phone. */
async function exportCsv(page: Page, name: string): Promise<{ file: string; csv: string }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name, exact: true }).dispatchEvent('click'),
  ])
  return { file: download.suggestedFilename(), csv: await downloadText(download) }
}

test.describe('Shared range and CSV export', () => {
  test('subscriptions: range kept in the URL, table and chart export CSV for the range', async ({
    browser, newUser, days, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId,
  }) => {
    const user = await newUser()
    const dbUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(user.phone) } })
    const marker = `E2E RangeSub ${randomBytes(3).toString('hex')}`
    await e2eDb().user.update({ where: { id: dbUser.id }, data: { fullName: marker } })
    await setUserSubscription({ userId: dbUser.id, status: 'PRO' })
    await e2eDb().subscription.updateMany({ where: { userId: dbUser.id }, data: { updatedAt: new Date() } })

    const admin = await createLoggedInAdmin(browser, { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId })
    try {
      const { page } = admin
      const from = days.daysAgo(10)
      const to = days.daysAgo(0)
      await page.goto(`/subscriptions?from=${from}&to=${to}&status=PRO`)
      const group = page.getByRole('group', { name: 'Date range' })
      await expect(group.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByText(`${from} to ${to} (Bangladesh days)`)).toBeVisible()

      // Table: whole filtered set for the range, BOM first, named by panel and range.
      const table = await exportCsv(page, 'Export Subscriptions as CSV')
      expect(table.csv.startsWith(BOM)).toBe(true)
      expect(table.csv).toContain(marker)
      expect(table.file).toBe(`subscriptions_${from}_${to}.csv`)

      // Chart: the trend for the same range, one row per Bangladesh day.
      const chart = await exportCsv(page, 'Export New Subscriptions as CSV')
      expect(chart.csv.startsWith(`${BOM}Date,Subscriptions\r\n${from},`)).toBe(true)
      expect(chart.csv.trimEnd().split('\r\n')).toHaveLength(11 + 1)
      expect(chart.file).toBe(`new-subscriptions_${from}_${to}.csv`)

      // Preset click swaps the range in the URL and keeps the other filter.
      await group.getByRole('button', { name: '7d' }).click()
      await expect(page).toHaveURL(/range=7d/)
      await expect(page).toHaveURL(/status=PRO/)
      await expect(page).not.toHaveURL(/from=/)
    } finally {
      await admin.context.close()
    }
  })

  test('emails: the range filters the log and the CSV; a wider range brings old mail back', async ({
    browser, days, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId,
  }) => {
    const runId = randomBytes(3).toString('hex')
    const recent = `e2e-range-recent-${runId}@example.com`
    const old = `e2e-range-old-${runId}@example.com`
    const mk = (to: string, sentAt: Date) =>
      e2eDb().emailLog.create({
        data: { type: 'LOGGING_REMINDER', to, subject: `=cmd ${runId}`, status: 'SENT', provider: 'RESEND', sentAt },
      })
    await mk(recent, days.startOf(days.daysAgo(2)))
    await mk(old, days.startOf(days.daysAgo(60)))

    const admin = await createLoggedInAdmin(browser, { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId })
    try {
      const { page } = admin
      await page.goto(`/emails?range=30d&search=${runId}`)
      await expect(page.getByText(recent)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(old)).toHaveCount(0)

      const { csv } = await exportCsv(page, 'Export Email logs as CSV')
      expect(csv.startsWith(BOM)).toBe(true)
      expect(csv).toContain(recent)
      expect(csv).not.toContain(old)
      expect(csv).toContain(`'=cmd ${runId}`) // formula-looking subject is neutralised

      const from = days.daysAgo(70)
      const to = days.daysAgo(0)
      await page.goto(`/emails?from=${from}&to=${to}&search=${runId}`)
      await expect(page.getByText(old)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(recent)).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('analytics: a chart exports the range in the URL', async ({
    browser, days, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId,
  }) => {
    const admin = await createLoggedInAdmin(browser, { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId })
    try {
      const { page } = admin
      const from = days.daysAgo(6)
      const to = days.daysAgo(0)
      await page.goto(`/analytics?from=${from}&to=${to}`)
      const { csv, file } = await exportCsv(page, 'Export Cycle Length Distribution as CSV')
      expect(csv.startsWith(BOM)).toBe(true)
      expect(file).toBe(`cycle-length-distribution_${from}_${to}.csv`)
    } finally {
      await admin.context.close()
    }
  })

  test('campaign history and feedback use the shared range control', async ({
    browser, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId,
  }) => {
    const admin = await createLoggedInAdmin(browser, { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId })
    try {
      const { page } = admin
      for (const path of ['/sms', '/feedback']) {
        await page.goto(`${path}?range=90d`)
        const group = page.getByRole('group', { name: 'Date range' })
        await expect(group.getByRole('button', { name: '90d' })).toHaveAttribute('aria-pressed', 'true')
        await group.getByRole('button', { name: '7d' }).click()
        await expect(page).toHaveURL(/range=7d/)
      }
      // Feedback keeps its own filtered-table export (still on /feedback here).
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible()
      await page.goto('/sms?range=7d')
      const campaigns = await exportCsv(page, 'Export Campaigns as CSV')
      expect(campaigns.csv.startsWith(`${BOM}ID,Name,Status`)).toBe(true)
    } finally {
      await admin.context.close()
    }
  })
})
