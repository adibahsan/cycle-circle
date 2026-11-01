/**
 * Handbook chapter "Emails" (docs/handbook/chapters/admin-emails.md), ticket #247.
 * Demo log rows (fake example.test addresses) are written to the database; the Admin screens
 * are the real ones. The Refresh button on the detail page is never clicked (it calls Resend).
 */
import type { PrismaClient } from '@prisma/client'
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })
test.describe.configure({ mode: 'serial' })

const HOUR = 3_600_000
const DETAIL_ID = 'hbdemo-email-detail'

async function seedEmails(db: PrismaClient) {
  // Only fake data may appear: drop the log rows this run's setup wrote, then add the demo rows.
  await db.emailLog.deleteMany({})
  const now = Date.now()
  const row = (
    n: number,
    hoursAgo: number,
    r: {
      type: 'MAGIC_LINK' | 'PERIOD_ALERT' | 'FERTILE_ALERT' | 'LOGGING_REMINDER'
      to: string
      subject: string
      status?: 'SENT' | 'FAILED'
      delivery?: 'PENDING' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'DELAYED'
      error?: string
      userId?: string
      profileId?: string
    },
  ) => ({
    id: n === 0 ? DETAIL_ID : `hbdemo-email-${n}`,
    type: r.type,
    to: r.to,
    subject: r.subject,
    status: r.status ?? 'SENT',
    error: r.error ?? null,
    provider: 'RESEND' as const,
    resendId: r.status === 'FAILED' ? null : `re_demo_${n}`,
    deliveryStatus: r.delivery ?? 'DELIVERED',
    userId: r.userId ?? null,
    profileId: r.profileId ?? null,
    sentAt: new Date(now - hoursAgo * HOUR),
  })
  await db.emailLog.createMany({
    data: [
      row(0, 1, { type: 'PERIOD_ALERT', to: 'tasnim.sultana@example.test', subject: 'Your period is expected in 2 days', userId: 'hbdemo-02', profileId: 'hbdemo-prof-hbdemo-02' }),
      row(1, 2, { type: 'MAGIC_LINK', to: 'shirin.nahar@example.test', subject: 'Your Cycle Circle sign-in link', delivery: 'PENDING' }),
      row(2, 5, { type: 'LOGGING_REMINDER', to: 'tania.ferdous@example.test', subject: 'How are you feeling today?' }),
      row(3, 8, { type: 'FERTILE_ALERT', to: 'lamia.rahman@example.test', subject: 'Your fertile window starts today', delivery: 'DELAYED' }),
      row(4, 14, { type: 'MAGIC_LINK', to: 'mim.chowdhury@example.test', subject: 'Your Cycle Circle sign-in link', delivery: 'BOUNCED' }),
      row(5, 20, { type: 'MAGIC_LINK', to: 'rubel@example.test', subject: 'Your Cycle Circle sign-in link', status: 'FAILED', delivery: 'PENDING', error: 'Error: connect ECONNREFUSED (demo failure)' }),
      row(6, 26, { type: 'PERIOD_ALERT', to: 'sumaiya.hoque@example.test', subject: 'Your period is expected in 2 days' }),
      row(7, 30, { type: 'LOGGING_REMINDER', to: 'jannat.ara@example.test', subject: 'How are you feeling today?', delivery: 'COMPLAINED' }),
    ],
  })
}

test.describe('Admin Emails', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
    await seedEmails(db)
  })

  test('email log', async ({ page }) => {
    await page.goto('/emails')
    await expect(page.getByRole('heading', { name: 'Email Logs', exact: true })).toBeVisible()
    await refreshData(page)
    await expect(page.getByText('tasnim.sultana@example.test').first()).toBeVisible()
    await shot(page, 'em-log')

    await page.goto('/emails?status=FAILED')
    await refreshData(page)
    await expect(page.getByText('rubel@example.test')).toBeVisible()
    await shot(page, 'em-log', { suffix: 'failed' })
  })

  test('email detail', async ({ page }) => {
    await page.goto(`/emails/${DETAIL_ID}`)
    await expect(page.getByRole('heading', { name: 'Email Preview', exact: true })).toBeVisible()
    await expect(page.frameLocator('iframe[title*="Email preview"]').getByText('Period Prediction')).toBeVisible({ timeout: 20_000 })
    await shot(page, 'em-detail')
  })

  test('template preview', async ({ page }) => {
    await page.goto('/emails/preview')
    await expect(page.getByRole('heading', { name: 'Email Preview', exact: true })).toBeVisible()
    const frame = page.frameLocator('iframe[title*="Email preview"]')
    await expect(frame.getByText('Period Prediction')).toBeVisible({ timeout: 20_000 })
    await shot(page, 'em-preview')

    await page.getByRole('button', { name: 'BN', exact: true }).click()
    await expect(frame.getByText('পিরিয়ড পূর্বাভাস')).toBeVisible({ timeout: 20_000 })
    await shot(page, 'em-preview', { suffix: 'bengali' })
  })
})
