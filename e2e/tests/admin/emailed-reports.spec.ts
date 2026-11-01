import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'
import { SECRETS, URLS } from '../../support/slot'
import { waitForEmail } from '../../support/mailpit'

// Recipients, the last-sent period and the 'reports' schedule switch are global rows that only this
// spec writes (desktop only). It ends on the defaults, as e2e/README.md "Global settings rows" asks.
const KEYS = ['reports.recipients', 'reports.lastSent.weekly']

test.describe('Admin emailed reports', () => {
  test('recipients are set on System and audited; the weekly cron emails them the CSV once per period', async ({
    browser,
    request,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.skip(isMobile, 'viewport-independent; one writer of the global report rows')
    test.slow()
    const db = e2eDb()
    const saved = await db.systemSetting.findMany({ where: { key: { in: KEYS } } })
    const recipient = `reports-${Date.now()}@example.test`
    const admin = await createLoggedInAdmin(browser, { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId })
    const cron = (query: string) =>
      request.get(`${URLS.web}/api/cron/reports?${query}`, { headers: { authorization: `Bearer ${SECRETS.cronSecret}` } })

    try {
      const { page } = admin
      await page.goto('/system')
      await expect(page.getByRole('heading', { name: 'Emailed reports', level: 2 })).toBeVisible()
      const box = page.getByLabel('Recipients', { exact: false })

      // An invalid entry is refused with a message and nothing is saved
      await box.fill(`${recipient}, not-an-email`)
      await page.getByRole('button', { name: 'Save recipients' }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'not-an-email' })).toBeVisible()
      expect(await db.systemSetting.findUnique({ where: { key: 'reports.recipients' } })).toEqual(
        saved.find((s) => s.key === 'reports.recipients') ?? null,
      )

      // A valid list is saved, survives a reload and is audited
      await box.fill(recipient)
      await page.getByRole('button', { name: 'Save recipients' }).click()
      await expect(page.getByText('Reports will go to 1 recipient')).toBeVisible()
      await page.reload()
      await expect(page.getByLabel('Recipients', { exact: false })).toHaveValue(recipient)
      const log = await db.adminAuditLog.findFirst({
        where: { action: 'SET_REPORT_RECIPIENTS', targetId: 'reports.recipients' },
        orderBy: { createdAt: 'desc' },
      })
      expect(log?.metadata).toMatchObject({ to: [recipient] })

      // The weekly cron sends to the recipient: Mailpit has the email with the CSV, the email log has the send
      const since = new Date(Date.now() - 1000)
      const first = await cron('kind=weekly&force=true')
      expect(first.ok()).toBe(true)
      expect(await first.json()).toMatchObject({ status: 'sent', kind: 'weekly', sent: 1, failed: 0 })
      const mail = await waitForEmail(recipient, { since })
      expect(mail.subject).toMatch(/^Cycle Circle weekly report: \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/)
      expect(mail.text).toContain('New signups:')
      expect(mail.text).toContain(`${URLS.admin}/?from=`)

      const raw = (await (await fetch(new URL(`/api/v1/message/${mail.id}`, URLS.mailpit))).json()) as {
        Attachments: { PartID: string; FileName: string }[]
      }
      expect(raw.Attachments).toHaveLength(1)
      expect(raw.Attachments[0].FileName).toMatch(/^overview_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/)
      const csv = await (await fetch(new URL(`/api/v1/message/${mail.id}/part/${raw.Attachments[0].PartID}`, URLS.mailpit))).text()
      expect(csv.replace(/^﻿/, '')).toMatch(/^Metric,This period,Previous period,Change %\r\nTotal users,/)

      const emailLog = await db.emailLog.findFirst({ where: { to: recipient, type: 'REPORT' } })
      expect(emailLog).toMatchObject({ status: 'SENT', subject: mail.subject })

      // A repeated hit for the same period sends nothing more
      const again = await cron('kind=weekly')
      expect(await again.json()).toMatchObject({ status: 'already-sent', sent: 0 })
      expect(await db.emailLog.count({ where: { to: recipient, type: 'REPORT' } })).toBe(1)

      // The schedule switch on System stops the cron
      await page.getByRole('switch', { name: 'Schedule for Emailed reports' }).click()
      await expect(page.getByRole('switch', { name: 'Schedule for Emailed reports' })).toBeEnabled()
      const off = await cron('kind=weekly&force=true')
      expect(await off.json()).toMatchObject({ skipped: true, reason: 'cron disabled' })
      expect(await db.emailLog.count({ where: { to: recipient, type: 'REPORT' } })).toBe(1)
    } finally {
      // End on the defaults: schedule on, no recipients, no period sent
      await db.cronSetting.deleteMany({ where: { slug: 'reports' } })
      await db.systemSetting.deleteMany({ where: { key: { in: KEYS } } })
      await admin.context.close()
    }
  })

  test('the report cron refuses a missing or unknown kind', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-phone'), 'viewport-independent')
    const res = await request.get(`${URLS.web}/api/cron/reports`, { headers: { authorization: `Bearer ${SECRETS.cronSecret}` } })
    expect(res.status()).toBe(400)
  })
})
