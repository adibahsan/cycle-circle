/**
 * Handbook chapters "Audit logs", "Logs" and "System" (docs/handbook/chapters/admin-audit-logs.md,
 * admin-logs.md, admin-system.md), ticket #248. Fake audit rows, log lines and runs only; nothing
 * here changes a setting or runs a job (the confirm windows are cancelled).
 */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { LOG_ROOT } from '../../../support/slot.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'
import { demoNowMs } from '../../support/demo-clock.ts'

test.use({ storageState: ADMIN_STATE })

const MIN = 60_000
const DAY = 24 * 60 * MIN
const dhakaDay = (d: Date) => new Date(d.getTime() + 6 * 60 * MIN).toISOString().slice(0, 10)
const dhakaTs = (d: Date) => new Date(d.getTime() + 6 * 60 * MIN).toISOString().replace('Z', '+06:00')

function writeLogLines(channel: string, lines: Array<Record<string, unknown>>) {
  const dir = path.join(LOG_ROOT, 'web', channel)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${dhakaDay(new Date())}.log`)
  // Idempotent: drop lines from an earlier run before appending (workers re-run beforeAll).
  const kept = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.includes('"hbdemo000')) : []
  fs.writeFileSync(file, [...kept, ...lines.map((l) => JSON.stringify(l))].join('\n') + '\n')
}

test.describe('Admin Audit logs, Logs, System', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
    const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' }, select: { id: true } })
    const now = demoNowMs()
    const rows: Array<[action: string, type: string, target: string, meta: object | null]> = [
      ['USER_SUSPENDED', 'User', 'hbaudit-user-1', { reason: 'abusive messages', bdapps: 'ok' }],
      ['PRO_GRANTED', 'User', 'hbaudit-user-2', { reason: 'support request' }],
      ['SET_CRON_ENABLED', 'CronJob', 'hbaudit-caas-check', { enabled: false }],
      ['SET_SMS_SEND_TIME', 'SystemSetting', 'hbaudit-sms-send-time', { from: '14:00', to: '16:30', timezone: 'Asia/Dhaka' }],
      ['TRIGGER_CRON_CAAS_CHECK', 'CronJob', 'hbaudit-caas-check', { counts: { checked: 24, moved: 1, errors: 0 } }],
      ['PRO_PRICE_SET', 'ProPrice', 'hbaudit-price', { from: { amount: 5, period: 'DAILY' }, to: { amount: 99, period: 'MONTHLY' } }],
      ['SET_REPORT_RECIPIENTS', 'SystemSetting', 'hbaudit-report-recipients', { from: [], to: ['owner@example.test'] }],
      ['ARTICLE_CREATED', 'Article', 'hbaudit-article-1', null],
      ['USER_REACTIVATED', 'User', 'hbaudit-user-1', null],
      ['EXPORT_USERS_CSV', 'User', 'hbaudit-export', { rows: 24 }],
    ]
    await db.adminAuditLog.createMany({
      data: rows.map(([action, targetType, targetId, metadata], i) => ({
        id: `hbaudit-${i + 1}`, adminId: admin.id, action, targetType, targetId,
        metadata: metadata ?? undefined, createdAt: new Date(now - (i + 1) * 47 * MIN),
      })),
      skipDuplicates: true,
    })

    // Subscription-check runs: newest scheduled run moved two Users and hit one error.
    await db.subscriptionCheckRun.createMany({
      data: [
        { id: 'hbaudit-run-1', startedAt: new Date(now - 1 * DAY), finishedAt: new Date(now - 1 * DAY + 52_000), trigger: 'CRON', status: 'OK', checkedCount: 24, movedCount: 2, errorCount: 1 },
        { id: 'hbaudit-run-2', startedAt: new Date(now - 2 * DAY), finishedAt: new Date(now - 2 * DAY), trigger: 'CRON', status: 'SKIPPED', checkedCount: 0, movedCount: 0, errorCount: 0 },
        { id: 'hbaudit-run-3', startedAt: new Date(now - 2 * DAY + 3_600_000), finishedAt: new Date(now - 2 * DAY + 3_600_000 + 31_000), trigger: 'MANUAL', status: 'OK', checkedCount: 24, movedCount: 0, errorCount: 0 },
      ],
      skipDuplicates: true,
    })
    await db.subscriptionCheckOutcome.createMany({
      data: [
        { id: 'hbaudit-out-1', runId: 'hbaudit-run-1', userId: 'hbdemo-09', maskedSubscriberId: 'tel:88017****109', outcome: 'MOVED_TO_FREE', bdappsStatus: 'UNREGISTERED' },
        { id: 'hbaudit-out-2', runId: 'hbaudit-run-1', userId: 'hbdemo-11', maskedSubscriberId: 'tel:88017****111', outcome: 'MOVED_TO_FREE', bdappsStatus: 'UNREGISTERED' },
        { id: 'hbaudit-out-3', runId: 'hbaudit-run-1', userId: 'hbdemo-13', maskedSubscriberId: 'tel:88017****113', outcome: 'ERROR', error: 'BDApps did not answer (timeout)' },
      ],
      skipDuplicates: true,
    })

    // A scheduled Pro price so the history shows more than one state.
    const future = dhakaDay(new Date(now + 7 * DAY))
    await db.proPrice.createMany({
      data: [{ id: 'hbaudit-price-1', amount: 99, period: 'MONTHLY', effectiveFrom: new Date(`${future}T00:00:00.000Z`), createdBy: admin.id }],
      skipDuplicates: true,
    })

    // Log lines (fake phones and ids). The OTP is raw in the file; the Logs page masks it.
    const t = (m: number) => dhakaTs(new Date(now - m * MIN))
    writeLogLines('merchant', [
      { ts: t(30), level: 'info', channel: 'merchant', event: 'subscription/otp/request', requestId: 'hbdemo0001aaaa', userId: 'hbdemo-02', durationMs: 412, data: { phone: '+8801711000101', referenceNo: 'hbdemo-ref-1' } },
      { ts: t(29), level: 'info', channel: 'merchant', event: 'subscription/otp/verify', requestId: 'hbdemo0001aaaa', userId: 'hbdemo-02', durationMs: 380, data: { referenceNo: 'hbdemo-ref-1', otp: '482913', statusCode: 'S1000' } },
      { ts: t(12), level: 'warn', channel: 'merchant', event: 'subscription/getStatus', requestId: 'hbdemo0002bbbb', userId: 'hbdemo-13', durationMs: 5003, data: { subscriberId: 'tel:88017****113', error: 'timeout' } },
    ])
    writeLogLines('webhook', [
      { ts: t(20), level: 'info', channel: 'webhook', event: 'subscription.notification', requestId: 'hbdemo0003cccc', data: { subscriberId: 'tel:88017****105', status: 'REGISTERED', action: 'plan kept Pro' } },
    ])
    writeLogLines('translog', [
      { ts: t(25), level: 'info', channel: 'translog', event: 'plan.changed', requestId: 'hbdemo0004dddd', userId: 'hbdemo-09', data: { from: 'PRO', to: 'FREE', cause: 'daily_check' } },
    ])
  })

  test('audit log: search and entries', async ({ page }) => {
    await page.goto('/audit-logs?search=hbaudit')
    await expect(page.getByRole('heading', { name: 'Audit Logs', exact: true })).toBeVisible()
    await refreshData(page)
    await expect(page.getByText('Trigger Cron Subscription Check')).toBeVisible()
    await shot(page, 'au-search')

    await page.getByRole('row', { name: /Pro Price Set/ }).getByRole('button', { name: 'Expand metadata' }).click()
    await shot(page, 'au-entries')
  })

  test('logs: channels, viewer and masking', async ({ page }) => {
    await page.goto('/logs?text=hbdemo')
    await expect(page.getByRole('heading', { name: 'Logs', exact: true })).toBeVisible()
    await expect(page.getByText('subscription/otp/verify', { exact: true }).first()).toBeVisible()
    await shot(page, 'lg-channels')

    await page.goto('/logs?channel=merchant&text=hbdemo0002bbbb')
    await expect(page.getByText('subscription/getStatus', { exact: true }).first()).toBeVisible()
    await page.locator('summary > span').first().click()
    await shot(page, 'lg-viewer')

    await page.goto('/logs?channel=merchant&text=hbdemo0001aaaa')
    await expect(page.getByText('subscription/otp/verify', { exact: true }).first()).toBeVisible()
    const verify = page.locator('details').filter({ hasText: 'subscription/otp/verify' })
    await verify.locator('summary > span').first().click() // not the centre: that is the request-id link
    await expect(verify.locator('pre')).toBeVisible()
    await expect(verify.locator('pre')).toContainText('<MASKED>')
    await expect(verify.locator('pre')).not.toContainText('482913')
    await shot(page, 'lg-masking')
  })

  test('system: every card', async ({ page }) => {
    await page.goto('/system')
    await expect(page.getByRole('heading', { name: 'System', level: 1 })).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Daily schedule for Daily subscription check' })).toBeVisible()
    await shot(page, 'sy-jobs')

    await page.getByRole('button', { name: 'Run Daily reminders cron job now' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, 'sy-manual-reminders')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Run Daily subscription check cron job now' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, 'sy-manual-sub-check')
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Each card is shot on its own so the three settings cards do not share one bottom-of-page view.
    const card = (name: string) => page.getByRole('heading', { name }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
    const scrollTo = (name: string) => page.getByRole('heading', { name }).evaluate((el) => el.scrollIntoView({ block: 'start' }))

    await scrollTo('Emailed reports')
    await shot(page, 'sy-report-recipients')

    await scrollTo('Pro price')
    await shot(page, 'sy-pro-price', { of: card('Pro price') })

    await scrollTo('SMS daily send time')
    await shot(page, 'sy-sms-time', { of: card('SMS daily send time') })

    await scrollTo('SMS delivery reports')
    await shot(page, 'sy-delivery-reports', { of: card('SMS delivery reports') })

    await scrollTo('Daily subscription check history')
    await expect(page.getByTestId('run-row').first()).toBeVisible()
    await shot(page, 'sy-runs')
  })

  test('system: run detail', async ({ page }) => {
    await page.goto('/system/runs/hbaudit-run-1')
    await expect(page.getByRole('heading', { name: 'Subscription check run' })).toBeVisible()
    await expect(page.getByTestId('moved-users')).toBeVisible()
    await shot(page, 'sy-run-detail')
  })
})
