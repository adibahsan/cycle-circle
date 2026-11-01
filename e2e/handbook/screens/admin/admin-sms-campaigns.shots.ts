/**
 * Handbook chapter "SMS campaigns" (docs/handbook/chapters/admin-sms-campaigns.md), ticket #247.
 *
 * Demo campaigns are written straight to the database (fake text, example names); the shots then
 * open the real Admin screens. Nothing is really sent: the send, cancel and resend screens stop at
 * the confirm dialog or work on a demo campaign only. The describe is serial because the files
 * share one set of demo campaigns and one "one SMS a day" calendar.
 */
import type { Locator, Page } from '@playwright/test'
import type { PrismaClient } from '@prisma/client'
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { bangladeshDayOf, serverNow } from '../../../support/bangladesh-day.ts'
import { ADMIN_STATE } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })
test.describe.configure({ mode: 'serial' })

const DAY_MS = 86_400_000
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const stored = (day: string) => new Date(`${day}T00:00:00.000Z`)
/** The daily send time, 14:00 Bangladesh time, on a Bangladesh day. */
const sentAtOn = (day: string) => new Date(`${day}T14:00:00.000+06:00`)

const NAMES = {
  monsoon: 'Monsoon hygiene week',
  hydration: 'Hydration reminders',
  ovulation: 'Ovulation awareness',
  pads: 'Pad donation drive',
  winter: 'Winter care tips',
}

type Msg = {
  offset: number
  body: string
  status: 'PLANNED' | 'SENT' | 'FAILED' | 'MISSED' | 'CANCELLED'
  counts?: { audience: number; delivered: number | null; failed: number | null }
  error?: string
}

async function seedCampaigns(db: PrismaClient, today: string) {
  const admin = await db.user.findFirstOrThrow({ where: { email: 'admin@vesta.health' }, select: { id: true } })
  await db.smsCampaign.deleteMany({ where: { name: { in: Object.values(NAMES) } } })

  const make = async (name: string, messages: Msg[], cancelled = false) => {
    await db.smsCampaign.create({
      data: {
        name,
        createdBy: admin.id,
        cancelledAt: cancelled ? new Date() : null,
        messages: {
          create: messages.map((m) => ({
            day: stored(addDays(today, m.offset)),
            body: m.body,
            status: m.status,
            sentAt: m.status === 'SENT' ? sentAtOn(addDays(today, m.offset)) : null,
            audienceSize: m.counts?.audience ?? null,
            deliveredCount: m.counts?.delivered ?? null,
            failedCount: m.counts?.failed ?? null,
            sendAttempts: m.status === 'SENT' || m.status === 'FAILED' ? 1 : 0,
            lastError: m.error ?? null,
            providerRequestId: m.status === 'SENT' ? `demo-req-${name}-${m.offset}` : null,
          })),
        },
      },
    })
  }

  // Oldest campaigns first: the list shows the newest created at the top.
  await make(NAMES.winter, [
    { offset: -9, body: 'Keep warm and drink warm water through the cold mornings.', status: 'SENT', counts: { audience: 18, delivered: null, failed: null } },
    { offset: 6, body: 'Moisturise dry skin after bathing in winter.', status: 'CANCELLED' },
  ], true)
  await make(NAMES.pads, [
    { offset: -6, body: 'Join our pad donation drive this month. Ask at your nearest health centre.', status: 'SENT', counts: { audience: 18, delivered: null, failed: null } },
  ])
  await make(NAMES.hydration, [
    { offset: -1, body: 'Drink at least eight glasses of water today.', status: 'SENT', counts: { audience: 18, delivered: 16, failed: 1 } },
    { offset: 3, body: 'Keep a water bottle with you and sip through the day.', status: 'PLANNED' },
    { offset: 4, body: 'Water-rich foods such as cucumber also help you stay hydrated.', status: 'PLANNED' },
    { offset: 7, body: 'Check your urine colour: pale means you are well hydrated.', status: 'PLANNED' },
  ])
  await make(NAMES.monsoon, [
    { offset: -4, body: 'Monsoon tip: change pads or cloth every 4 to 6 hours.', status: 'SENT', counts: { audience: 18, delivered: 15, failed: 2 } },
    { offset: -3, body: 'Wash your hands with soap before and after changing a pad.', status: 'MISSED', error: 'Missed: not sent on its day.' },
    { offset: -2, body: 'Dry reusable cloth in sunlight, never in a damp room.', status: 'FAILED', error: 'BDApps rejected the send (demo error).' },
    { offset: 1, body: 'Boil drinking water or use a filter during the rains.', status: 'PLANNED' },
    { offset: 2, body: 'See a doctor if you have itching, odour or unusual discharge.', status: 'PLANNED' },
  ])
  await make(NAMES.ovulation, [
    { offset: 5, body: 'Did you know? Ovulation usually happens 12 to 16 days before your next period.', status: 'PLANNED' },
  ])
}

async function campaignId(db: PrismaClient, name: string) {
  return (await db.smsCampaign.findFirstOrThrow({ where: { name }, select: { id: true } })).id
}

async function openCreate(page: Page) {
  await page.getByRole('button', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'New SMS Campaign' })).toBeVisible()
  return dialog
}

async function fillDay(input: Locator, day: string) {
  await expect(async () => {
    await input.fill(day, { timeout: 3_000 })
    await expect(input).toHaveValue(day, { timeout: 1_000 })
  }).toPass({ timeout: 20_000 })
}

test.describe('Admin SMS campaigns', () => {
  let today = ''

  test.beforeAll(async ({ db }) => {
    today = bangladeshDayOf(await serverNow())
    await seedCampaigns(db, today)
  })

  test('campaign list', async ({ page }) => {
    await page.goto('/sms')
    await expect(page.getByRole('heading', { name: 'SMS Campaigns', exact: true })).toBeVisible()
    await refreshData(page)
    await expect(page.getByRole('link', { name: NAMES.monsoon })).toBeVisible()
    await shot(page, 'sm-list')

    await page.getByPlaceholder('Search campaigns…').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'sm-list', { suffix: 'table' })
  })

  test('create a campaign, then import a CSV', async ({ page }) => {
    await page.goto('/sms')
    const dialog = await openCreate(page)
    await dialog.getByLabel('Campaign name').fill('Cycle health basics')
    await fillDay(dialog.getByLabel('Day 1', { exact: true }), addDays(today, 10))
    await dialog.getByLabel('Message 1', { exact: true }).fill('A normal cycle is 21 to 45 days long. Track yours to know what is normal for you.')
    await expect(dialog.getByText('1 SMS part · GSM-7, 160/153 per part')).toBeVisible()
    await shot(page, 'sm-create')

    await dialog.getByRole('tab', { name: 'Import CSV' }).click()
    await expect(dialog.getByLabel('CSV file')).toBeVisible()
    await shot(page, 'sm-import')

    // A file with problems: the whole file is refused and every bad line is listed.
    const bad = [
      'day,text',
      `${addDays(today, 10)},"Rest well during your period."`,
      `${addDays(today, -2)},"This day is already over."`,
      `2026-13-40,"This is not a real day."`,
      `${addDays(today, 15)},`,
    ].join('\n')
    await dialog.getByLabel('Campaign name').fill('Period comfort tips')
    await dialog.getByLabel('CSV file').setInputFiles({ name: 'period-comfort.csv', mimeType: 'text/csv', buffer: Buffer.from(bad) })
    await expect(dialog.getByText('Selected: period-comfort.csv')).toBeVisible()
    await dialog.getByRole('button', { name: 'Import campaign' }).click()
    await expect(dialog.getByRole('alert')).toContainText('rows have problems; nothing was imported')
    await shot(page, 'sm-import', { suffix: 'errors' })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
  })

  test('per-message view, delivery status, schedule and resend', async ({ page, db }) => {
    const id = await campaignId(db, NAMES.monsoon)
    await page.goto(`/sms/${id}`)
    await expect(page.getByRole('heading', { name: NAMES.monsoon })).toBeVisible()
    await expect(page.getByText('Wash your hands with soap')).toBeVisible()
    await shot(page, 'sm-messages')

    // Delivery status: the totals line and the Result column.
    await shot(page, 'sm-delivery', { of: page.getByTestId('campaign-totals').locator('xpath=..') })
    const reportsOff = await campaignId(db, NAMES.pads)
    await page.goto(`/sms/${reportsOff}`)
    await expect(page.getByTestId('message-result')).toContainText('Delivery reports off')
    await shot(page, 'sm-delivery', { suffix: 'reports-off' })

    // Move a planned message to another day.
    await page.goto(`/sms/${id}`)
    await page.getByRole('button', { name: /^Move message for .* to another day$/ }).first().click()
    const move = page.getByRole('dialog')
    await expect(move.getByRole('heading', { name: 'Move message to another day' })).toBeVisible()
    await fillDay(move.getByLabel('New day (Bangladesh)'), addDays(today, 8))
    await shot(page, 'sm-schedule')
    await move.getByRole('button', { name: 'Cancel' }).click()

    // Add one more day.
    await page.getByRole('button', { name: 'Add day' }).click()
    const add = page.getByRole('dialog')
    await expect(add.getByRole('heading', { name: 'Add a day' })).toBeVisible()
    await fillDay(add.getByLabel('Day (Bangladesh)'), addDays(today, 9))
    await add.getByLabel('New message').fill('Rest and warmth can ease period cramps.')
    await shot(page, 'sm-schedule', { suffix: 'add-day' })
    await add.getByRole('button', { name: 'Cancel' }).click()

    // Resend the failed day on a free day.
    await page.getByRole('button', { name: /^Resend message for .* on a free day$/ }).last().click()
    const resend = page.getByRole('dialog')
    await expect(resend.getByRole('heading', { name: 'Resend on a free day' })).toBeVisible()
    await fillDay(resend.getByLabel('Free day (Bangladesh)'), addDays(today, 8))
    await shot(page, 'sm-resend')
    await resend.getByRole('button', { name: 'Cancel' }).click()
  })

  test('send a campaign', async ({ page }) => {
    await page.goto('/sms')
    await refreshData(page)
    const row = page.getByRole('row', { name: new RegExp(NAMES.ovulation) })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Send message now' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Send Message Now?' })).toBeVisible()
    await shot(page, 'sm-send')
    await dialog.getByRole('button', { name: 'Cancel' }).click() // nothing is sent
  })

  test('cancel a campaign', async ({ page, db }) => {
    const id = await campaignId(db, NAMES.hydration)
    await page.goto(`/sms/${id}`)
    await expect(page.getByRole('heading', { name: NAMES.hydration })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel campaign' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Cancel this campaign?' })).toBeVisible()
    await shot(page, 'sm-cancel')

    await dialog.getByRole('button', { name: 'Cancel campaign' }).click()
    await expect(page.getByTestId('campaign-cancelled-summary')).toHaveText('Cancelled, 1 of 4 sent')
    await shot(page, 'sm-cancel', { suffix: 'result' })
  })
})
