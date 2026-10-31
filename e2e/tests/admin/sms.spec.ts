/**
 * Admin SMS campaigns (#129, #196).
 *
 * One admin create is a one-day campaign with one message. Production send uses BDApps
 * `destinationAddresses: ['tel:all']` (all subscribers) with that message's single body, composed
 * from the English/Bengali fields by the chosen send language (see #143). Assertions are scoped
 * to unique message markers and throwaway subscribers; other parallel tests may also hit
 * `/sms/send`.
 *
 * At most one planned message exists per Bangladesh day across all campaigns, and every test
 * shares one database, so each test plans its message on its own random far-away day.
 *
 * Delivery-report coverage is the webhook path kept for a plan change; prod sends with
 * `deliveryStatusRequest: 0` because reports are disabled (E1312). Reports correlate on the
 * BDApps `requestId`, stored as `providerRequestId`.
 */
import { randomBytes } from 'node:crypto'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'
import { submitDialog } from '../../support/dialogs'
import { toDbPhone } from '../../support/users'
import { SECRETS, URLS } from '../../support/slot'
import type { FakeBdappsClient, RecordedCall } from '../../support/fake-bdapps'

const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

/** Merchant `/sms/send` calls whose body message contains `marker`. */
function smsCallsWithMarker(calls: RecordedCall[], marker: string): RecordedCall[] {
  return calls.filter(
    (c) =>
      c.path === '/sms/send' &&
      typeof c.body.message === 'string' &&
      (c.body.message as string).includes(marker),
  )
}

async function waitForSmsCalls(
  fake: FakeBdappsClient,
  marker: string,
  opts: { sinceSeq?: number; min?: number; timeoutMs?: number } = {},
): Promise<RecordedCall[]> {
  const sinceSeq = opts.sinceSeq ?? 0
  const min = opts.min ?? 1
  const deadline = Date.now() + (opts.timeoutMs ?? 30_000)
  for (;;) {
    const mine = smsCallsWithMarker(await fake.calls({ path: '/sms/send', sinceSeq }), marker)
    if (mine.length >= min) return mine
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${min} /sms/send call(s) containing ${JSON.stringify(marker)}`)
    }
    await new Promise((r) => setTimeout(r, 200))
  }
}

async function triggerDailyRemindersCron(
  request: import('@playwright/test').APIRequestContext,
  userId: string,
): Promise<{ status: number; json: unknown }> {
  const res = await request.post(`${URLS.web}/api/cron/daily-reminders`, {
    headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
    // Scope per-user reminders to the throwaway so we do not fan out to every due user.
    // Scheduled SMS dispatch still runs once per cron call (independent of userId).
    data: { overrideDisabled: true, userId },
  })
  return { status: res.status(), json: await res.json().catch(() => null) }
}

/** Poll cron until our planned marker appears at the fake (other due messages may go first). */
async function dispatchUntilMarker(
  request: import('@playwright/test').APIRequestContext,
  fake: FakeBdappsClient,
  marker: string,
  sinceSeq: number,
  userId: string,
): Promise<RecordedCall[]> {
  for (let i = 0; i < 12; i++) {
    const cron = await triggerDailyRemindersCron(request, userId)
    expect(cron.status).toBe(200)
    const mine = smsCallsWithMarker(await fake.calls({ path: '/sms/send', sinceSeq }), marker)
    if (mine.length >= 1) return mine
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`cron never dispatched a campaign message containing ${JSON.stringify(marker)}`)
}

const DAY_MS = 86_400_000

/** A random day (YYYY-MM-DD) in [from, from + spanDays): tests never share a message day. */
function randomDay(fromIso: string, spanDays: number): string {
  const t = Date.parse(`${fromIso}T00:00:00Z`) + Math.floor(Math.random() * spanDays) * DAY_MS
  return new Date(t).toISOString().slice(0, 10)
}
/** Far in the future: the message stays PLANNED until an admin sends it. */
const futureDay = () => randomDay('2060-01-01', 14_000)
/** Long past: the cron marks it Missed and never sends it. */
const pastDay = () => randomDay('1971-01-01', 10_000)

const SEND_TIME_KEY = 'sms.dailySendTime'
/** Today's Bangladesh day, stored the way the message `day` column is. */
const todayStored = () => new Date(`${new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10)}T00:00:00.000Z`)

/** Remove a test's campaigns (and so their messages) so no PLANNED row outlives it. */
async function removeCampaigns(runId: string) {
  await e2eDb().smsCampaign.deleteMany({ where: { name: { contains: runId } } })
}

async function openCreateModal(page: import('@playwright/test').Page) {
  const newBtn = page.getByRole('button', { name: 'New Campaign' })
  const heading = page.getByRole('heading', { name: 'New SMS Campaign' })
  await expect(newBtn).toBeVisible({ timeout: 15_000 })
  // Phone layout: sticky chrome / chart canvases sit above the button hit-target, so a click
  // can focus without opening the dialog — not an overlay bug in the app. On a slow runner the
  // button can also be re-rendered (hydration) under the click. Click again until it opens.
  await expect(async () => {
    if (!(await heading.isVisible())) {
      // Keyboard activation: no hit-test, so sticky chrome over the button can't swallow it.
      await newBtn.focus()
      await newBtn.press('Enter', { timeout: 3_000 })
    }
    await expect(heading).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
  return page.getByRole('dialog').filter({ has: heading })
}

/** Fill the composer: a name and the first day's text. Days are Bangladesh days (`YYYY-MM-DD`). */
async function fillCampaign(
  dialog: import('@playwright/test').Locator,
  name: string,
  messages: { day: string; body: string }[],
) {
  await dialog.getByLabel('Campaign name').fill(name)
  for (const [i, m] of messages.entries()) {
    if (i > 0) await dialog.getByRole('button', { name: 'Add another day' }).click()
    // Fill until the value sticks: a controlled date input can lose a fill that lands mid-hydration.
    const dayInput = dialog.getByLabel(`Day ${i + 1}`, { exact: true })
    await expect(async () => {
      await dayInput.fill(m.day, { timeout: 3_000 })
      await expect(dayInput).toHaveValue(m.day, { timeout: 1_000 })
    }).toPass({ timeout: 20_000 })
    await dialog.getByLabel(`Message ${i + 1}`, { exact: true }).fill(m.body)
  }
}

/** Table row for a campaign (name cell). Prefer role=row after the create dialog closes. */
function campaignRow(page: import('@playwright/test').Page, marker: string) {
  return page.getByRole('row').filter({ hasText: marker })
}

/**
 * Action column sits under sticky pagination / overlapping cells on the phone
 * project's narrow horizontal table — keyboard activation sidesteps the overlap (a viewport
 * layout quirk, not a missing accessible control).
 */
async function clickRowAction(page: import('@playwright/test').Page, marker: string, name: string) {
  const btn = campaignRow(page, marker).getByRole('button', { name })
  await btn.scrollIntoViewIfNeeded()
  await btn.focus()
  await btn.press('Enter')
}

type AdminOpts = Parameters<typeof createLoggedInAdmin>[1]

/** Open /sms as a logged-in admin and run `fn`, always closing the context. */
async function withAdminPage(
  browser: import('@playwright/test').Browser,
  opts: AdminOpts,
  fn: (admin: Awaited<ReturnType<typeof createLoggedInAdmin>>) => Promise<void>,
) {
  const admin = await createLoggedInAdmin(browser, opts)
  try {
    await admin.page.goto('/sms?pageSize=100')
    await expect(admin.page.getByRole('heading', { name: 'SMS Campaigns' })).toBeVisible()
    await fn(admin)
  } finally {
    await admin.context.close()
  }
}

test.describe('Admin SMS campaigns', () => {
  test('a campaign message reaches BDApps as its single body, and the campaign shows in the list and detail', async ({
    browser,
    newUser,
    fakeBdapps,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.setTimeout(150_000)
    const runId = randomBytes(3).toString('hex')
    const enMarker = `E2E SMS EN ${runId}`
    const bnMarker = `E2E SMS BN ${runId}`
    // Throwaway subscriber so tel:all expansion includes at least one REGISTERED number.
    await newUser()

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page }) => {
          const dialog = await openCreateModal(page)
          await fillCampaign(dialog, enMarker, [{ day: futureDay(), body: `${enMarker}\n${bnMarker}` }])
          await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0)
          // The list shows every status by default, so a planned campaign is there without filtering.
          await expect(campaignRow(page, enMarker)).toBeVisible({ timeout: 15_000 })
          await expect(campaignRow(page, enMarker).getByText('Planned', { exact: true })).toBeVisible()

          await clickRowAction(page, enMarker, 'Send message now')
          await expect(page.getByRole('heading', { name: 'Send Message Now?' })).toBeVisible()
          await page.getByRole('button', { name: 'Send Now', exact: true }).click()
          await expect(page.getByText('Message sent')).toBeVisible({ timeout: 30_000 })

          // Note: destination is tel:all (all subscribers). Scope by unique message text only.
          const mine = await waitForSmsCalls(fakeBdapps, enMarker, { sinceSeq })
          expect(mine.length).toBeGreaterThanOrEqual(1)
          const last = mine[mine.length - 1]
          expect(last.body.destinationAddresses).toEqual(['tel:all'])
          expect(last.body.message).toBe(`${enMarker}\n${bnMarker}`)
          expect(last.response).toMatchObject({ statusCode: 'S1000' })
          expect(last.response.requestId).toBeTruthy()

          // Sent history stays in the default list, as a finished campaign.
          await page.getByRole('button', { name: 'Refresh data' }).click()
          await expect(campaignRow(page, enMarker).getByText('Finished', { exact: true })).toBeVisible({ timeout: 15_000 })
          await expect(campaignRow(page, enMarker).getByText('1 of 1 sent')).toBeVisible()

          // Read-only detail: the day's message, its status and when it went out (Bangladesh time).
          // Keyboard activation: on the phone project the name cell sits under sticky pagination.
          const detailLink = campaignRow(page, enMarker).getByRole('link')
          await detailLink.scrollIntoViewIfNeeded()
          await detailLink.focus()
          await detailLink.press('Enter')
          await expect(page).toHaveURL(/\/sms\/[^/?]+$/)
          const detailRow = page.getByRole('row').filter({ hasText: enMarker })
          await expect(detailRow).toBeVisible({ timeout: 15_000 })
          await expect(detailRow.getByText(bnMarker)).toBeVisible()
          await expect(detailRow.getByText('Sent', { exact: true })).toBeVisible()
          await expect(detailRow.getByText(/\d{4}, \d{2}:\d{2} (AM|PM)/)).toBeVisible()
        },
      )

      const message = await e2eDb().smsCampaignMessage.findFirstOrThrow({ where: { body: { contains: enMarker } } })
      expect(message.status).toBe('SENT')
    } finally {
      await removeCampaigns(runId)
    }
  })

  test('a Bengali message is counted as Unicode and reaches BDApps as written', async ({
    browser,
    newUser,
    fakeBdapps,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.setTimeout(150_000)
    const runId = randomBytes(3).toString('hex')
    const bnMarker = `E2E SMS Bangla ${runId}`
    const banglaBody = `${bnMarker} আজ পর্যাপ্ত পানি পান করুন।`
    await newUser()

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page }) => {
          const dialog = await openCreateModal(page)
          await fillCampaign(dialog, bnMarker, [{ day: futureDay(), body: banglaBody }])
          // Bengali text is counted as Unicode (70/67 per part).
          await expect(dialog.getByText(/Unicode \(Bengali\), 70\/67 per part/)).toBeVisible()
          await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0)
          // The campaign is named from the composed body, which is the Bengali text only.
          await expect(campaignRow(page, bnMarker)).toBeVisible({ timeout: 15_000 })

          await clickRowAction(page, bnMarker, 'Send message now')
          await page.getByRole('button', { name: 'Send Now', exact: true }).click()
          await expect(page.getByText('Message sent')).toBeVisible({ timeout: 30_000 })

          const mine = await waitForSmsCalls(fakeBdapps, bnMarker, { sinceSeq })
          const last = mine[mine.length - 1]
          expect(last.body.destinationAddresses).toEqual(['tel:all'])
          expect(last.body.message).toBe(banglaBody)
          expect(last.response).toMatchObject({ statusCode: 'S1000' })
        },
      )
    } finally {
      await removeCampaigns(runId)
    }
  })

  test('the cron sends today\'s planned message after the daily send time, and marks a past day Missed', async ({
    browser,
    newUser,
    fakeBdapps,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    // Today's Bangladesh day holds one planned message across the slot: run it once, on desktop.
    test.skip(!!isMobile, 'cron dispatch is viewport-independent; desktop only')
    const runId = randomBytes(3).toString('hex')
    const enMarker = `E2E SMS Sched ${runId}`
    const bnMarker = `E2E SMS Sched BN ${runId}`
    const subscriber = await newUser() // ensure at least one REGISTERED subscriber for tel:all
    const cronUser = await e2eDb().user.findUniqueOrThrow({
      where: { phone: toDbPhone(subscriber.phone) },
      select: { id: true },
    })

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    const db = e2eDb()
    try {
      // Midnight Bangladesh time: the send time has passed whenever the cron runs today.
      await db.systemSetting.upsert({
        where: { key: SEND_TIME_KEY },
        create: { key: SEND_TIME_KEY, value: '00:00' },
        update: { value: '00:00' },
      })
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page, context }) => {
          const dialog = await openCreateModal(page)
          // The composer refuses past days: plan a future day, then move it below.
          await fillCampaign(dialog, enMarker, [{ day: futureDay(), body: `${enMarker}\n${bnMarker}` }])
          await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0)
          await expect(campaignRow(page, enMarker)).toBeVisible({ timeout: 15_000 })
          await expect(campaignRow(page, enMarker).getByText('Planned', { exact: true })).toBeVisible()

          // Move it to today (Bangladesh), and plant an unsent message on a long-past day.
          await db.smsCampaignMessage.updateMany({
            where: { campaign: { name: { contains: runId } } },
            data: { day: todayStored() },
          })
          const creator = await db.smsCampaign.findFirstOrThrow({ where: { name: { contains: runId } }, select: { createdBy: true } })
          const pastCampaign = await db.smsCampaign.create({
            data: {
              name: `Past ${runId}`,
              createdBy: creator.createdBy,
              messages: { create: { day: new Date(`${pastDay()}T00:00:00.000Z`), body: `E2E past ${runId}` } },
            },
          })

          const mine = await dispatchUntilMarker(context.request, fakeBdapps, enMarker, sinceSeq, cronUser.id)
          expect(mine[mine.length - 1].body.message).toBe(`${enMarker}\n${bnMarker}`)
          expect(mine[mine.length - 1].body.destinationAddresses).toEqual(['tel:all'])

          // The past day is Missed, and nothing was sent for it.
          const past = await db.smsCampaignMessage.findFirstOrThrow({ where: { campaignId: pastCampaign.id } })
          expect(past.status).toBe('MISSED')
          expect(smsCallsWithMarker(await fakeBdapps.calls({ path: '/sms/send', sinceSeq }), `E2E past ${runId}`)).toHaveLength(0)

          await page.getByRole('button', { name: 'Refresh data' }).click()
          await expect(campaignRow(page, enMarker).getByText('Finished', { exact: true })).toBeVisible({ timeout: 15_000 })
        },
      )
    } finally {
      // Send time stays 00:00 (see system.spec.ts): restoring could race the System test.
      // Leave no past-due PLANNED row for later cron polls in this slot.
      await removeCampaigns(runId)
    }
  })

  test('a scripted BDApps failure is not re-sent and the message ends Failed', async ({
    browser,
    newUser,
    fakeBdapps,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const runId = randomBytes(3).toString('hex')
    test.setTimeout(150_000)
    const enMarker = `E2E SMS Retry ${runId}`
    await newUser()

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page }) => {
          const dialog = await openCreateModal(page)
          await fillCampaign(dialog, enMarker, [{ day: futureDay(), body: enMarker }])
          await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0)
          await expect(campaignRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

          // messageContains scopes tel:all failures so parallel workers cannot steal this one.
          await fakeBdapps.failNext('/sms/send', {
            match: { messageContains: enMarker },
            mode: 'error',
            statusCode: 'E1601',
            times: 1,
          })

          await clickRowAction(page, enMarker, 'Send message now')
          await page.getByRole('button', { name: 'Send Now', exact: true }).click()

          // One layer retries and a rejected send is final: exactly one provider call, message Failed.
          const mine = await waitForSmsCalls(fakeBdapps, enMarker, { sinceSeq })
          const findMessage = () => e2eDb().smsCampaignMessage.findFirst({ where: { body: { contains: enMarker } } })
          await expect.poll(async () => (await findMessage())?.status, { timeout: 30_000 }).toBe('FAILED')
          expect(mine).toHaveLength(1)
          expect(mine[0].response).toMatchObject({ statusCode: 'E1601' })
          expect((await findMessage())?.lastError).toBeTruthy()
        },
      )
    } finally {
      await removeCampaigns(runId)
    }
  })

  test('double-click on Send Now records exactly one send at BDApps', async ({
    browser,
    newUser,
    fakeBdapps,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const runId = randomBytes(3).toString('hex')
    test.setTimeout(150_000)
    const enMarker = `E2E SMS Dbl ${runId}`
    await newUser()

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page }) => {
          const dialog = await openCreateModal(page)
          await fillCampaign(dialog, enMarker, [{ day: futureDay(), body: enMarker }])
          await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0)
          await expect(campaignRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

          await clickRowAction(page, enMarker, 'Send message now')
          await page.getByRole('button', { name: 'Send Now', exact: true }).dblclick()

          await expect
            .poll(async () => (await e2eDb().smsCampaignMessage.findFirst({ where: { body: { contains: enMarker } } }))?.status, {
              timeout: 30_000,
            })
            .toBe('SENT')
          await expect(page.getByText('Message sent')).toBeVisible({ timeout: 30_000 })
          const mine = smsCallsWithMarker(await fakeBdapps.calls({ path: '/sms/send', sinceSeq }), enMarker)
          expect(mine).toHaveLength(1)
        },
      )
    } finally {
      await removeCampaigns(runId)
    }
  })

  test('delivery-report webhook correlates on the BDApps requestId and updates delivered/failed counts', async ({
    browser,
    newUser,
    fakeBdapps,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.setTimeout(150_000)
    const runId = randomBytes(3).toString('hex')
    const enMarker = `E2E SMS Report ${runId}`
    const recipient = await newUser()
    const maskedId = (await fakeBdapps.subscriber(recipient.phone))!.maskedId

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page }) => {
          const dialog = await openCreateModal(page)
          await fillCampaign(dialog, enMarker, [{ day: futureDay(), body: enMarker }])
          await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0)
          await expect(campaignRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

          await clickRowAction(page, enMarker, 'Send message now')
          await page.getByRole('button', { name: 'Send Now', exact: true }).click()
          await expect(page.getByText('Message sent')).toBeVisible({ timeout: 30_000 })

          const mine = await waitForSmsCalls(fakeBdapps, enMarker, { sinceSeq })
          const sent = mine[mine.length - 1]
          expect(sent.body.message).toBe(enMarker)

          const destResponses = sent.response.destinationResponses as Array<{ messageId?: string }> | undefined
          const fakeMessageId = destResponses?.[0]?.messageId
          const fakeRequestId = sent.response.requestId as string | undefined
          expect(fakeMessageId).toBeTruthy()
          expect(fakeRequestId).toBeTruthy()

          const message = await e2eDb().smsCampaignMessage.findFirstOrThrow({ where: { body: enMarker } })
          expect(message.status).toBe('SENT')
          expect(message.deliveredCount ?? 0).toBe(0)
          // The app keeps both ids; BDApps reports echo the requestId, so that is what correlates.
          expect(message.providerRequestId).toBe(fakeRequestId)
          expect(message.providerMessageId).toBe(fakeMessageId)

          const delivered = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
            destinationAddress: maskedId,
            requestId: message.providerRequestId!,
            deliveryStatus: 'DELIVERED',
            timeStamp: stamp(),
          })
          expect(delivered).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

          const afterDelivered = await e2eDb().smsCampaignMessage.findUniqueOrThrow({ where: { id: message.id } })
          expect(afterDelivered.deliveredCount).toBe(1)
          expect(afterDelivered.failedCount ?? 0).toBe(0)

          const failed = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
            destinationAddress: `${maskedId}-other`,
            requestId: message.providerRequestId!,
            deliveryStatus: 'FAILED',
            timeStamp: stamp(),
          })
          expect(failed).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

          const afterFailed = await e2eDb().smsCampaignMessage.findUniqueOrThrow({ where: { id: message.id } })
          expect(afterFailed.failedCount).toBe(1)
          expect(afterFailed.deliveredCount).toBe(1)
        },
      )
    } finally {
      await removeCampaigns(runId)
    }
  })

  test('an unsent message can be edited and moved to another day, and its campaign deleted', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.setTimeout(150_000)
    const runId = randomBytes(3).toString('hex')
    const enMarker = `E2E SMS Edit ${runId}`
    const edited = `E2E SMS Edited ${runId}`
    const newDay = futureDay()

    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page }) => {
          const dialog = await openCreateModal(page)
          await fillCampaign(dialog, enMarker, [{ day: futureDay(), body: enMarker }])
          await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0)
          await expect(campaignRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

          await clickRowAction(page, enMarker, 'Edit message')
          const edit = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit message' }) })
          await edit.getByLabel('Message', { exact: true }).fill(edited)
          await submitDialog(edit, 'Save changes', { headingName: 'Edit message', exact: false })
          await expect(page.getByText('Message updated')).toBeVisible({ timeout: 15_000 })
          await expect
            .poll(async () => (await e2eDb().smsCampaignMessage.findFirst({ where: { body: edited } }))?.status, { timeout: 15_000 })
            .toBe('PLANNED')

          await clickRowAction(page, enMarker, 'Move message to another day')
          const move = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Move message to another day' }) })
          await move.getByLabel('New day (Bangladesh)').fill(newDay)
          await move.getByRole('button', { name: 'Move message' }).click()
          await expect(page.getByText('Message moved')).toBeVisible({ timeout: 15_000 })
          const row = await e2eDb().smsCampaignMessage.findFirstOrThrow({ where: { body: edited } })
          expect(row.day.toISOString().slice(0, 10)).toBe(newDay)

          await clickRowAction(page, enMarker, 'Delete campaign')
          await page.getByRole('button', { name: 'Delete', exact: true }).click()
          await expect(page.getByText('Campaign deleted')).toBeVisible({ timeout: 15_000 })
          expect(await e2eDb().smsCampaignMessage.count({ where: { body: edited } })).toBe(0)
        },
      )
    } finally {
      await removeCampaigns(runId)
    }
  })

  test('a campaign plans non-consecutive days; a clashing or past day is refused inline and nothing is created', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.setTimeout(150_000)
    const runId = randomBytes(3).toString('hex')
    const first = `E2E SMS Clash A ${runId}`
    const second = `E2E SMS Clash B ${runId}`
    const day = futureDay()
    const laterDay = futureDay()
    const otherDay = futureDay()

    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page }) => {
          // Two non-consecutive days, each with its own text.
          let dialog = await openCreateModal(page)
          await fillCampaign(dialog, first, [
            { day, body: `${first} one` },
            { day: laterDay, body: `${first} two` },
          ])
          await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
          await expect(campaignRow(page, first)).toBeVisible({ timeout: 15_000 })
          await expect(campaignRow(page, first).getByText('Planned', { exact: true })).toBeVisible()
          expect(await e2eDb().smsCampaignMessage.count({ where: { body: { contains: first } } })).toBe(2)

          // A second campaign whose later day is the first campaign's second day.
          dialog = await openCreateModal(page)
          await fillCampaign(dialog, second, [
            { day: otherDay, body: `${second} one` },
            { day: laterDay, body: `${second} two` },
          ])
          const create = dialog.getByRole('button', { name: 'Create campaign', exact: true })
          if (isMobile) {
            // One synthetic click: the first campaign's toast can cover the button on phone.
            await create.dispatchEvent('click')
          } else {
            await create.click()
          }
          // Refused inline, naming the campaign that holds the day. Nothing was created.
          await expect(dialog.getByRole('alert')).toContainText(`"${first}"`, { timeout: 15_000 })
          await expect(dialog.getByRole('alert')).toContainText(laterDay)
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toBeVisible()
          expect(await e2eDb().smsCampaign.count({ where: { name: { contains: second } } })).toBe(0)

          // A past Bangladesh day is refused too.
          await dialog.getByLabel('Day 1').fill('2020-01-01')
          await create.dispatchEvent('click')
          await expect(dialog.getByRole('alert')).toContainText(/past/i)
          expect(await e2eDb().smsCampaign.count({ where: { name: { contains: second } } })).toBe(0)
        },
      )
    } finally {
      await removeCampaigns(runId)
    }
  })
})

/**
 * Results and the delivery-report switch (#200). The switch is one global row, so a single
 * desktop-only test is its only writer: it starts and ends with the row absent (= off), and the
 * other tests here read nothing from it. Counts are asserted per message, which records at send
 * time whether reports were requested, so a stray send from a parallel test cannot disturb them.
 */
test.describe('Campaign results', () => {
  test('reports off shows "delivery reports off"; switching on requests reports and the webhook moves the counts', async ({
    browser,
    newUser,
    fakeBdapps,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.skip(isMobile, 'viewport-independent; one writer of the global delivery-report row')
    test.setTimeout(180_000)
    const key = 'sms.deliveryReports'
    const runId = randomBytes(3).toString('hex')
    const offMarker = `E2E SMS Off ${runId}`
    const onMarker = `E2E SMS On ${runId}`
    const recipient = await newUser()
    const maskedId = (await fakeBdapps.subscriber(recipient.phone))!.maskedId
    await e2eDb().systemSetting.deleteMany({ where: { key } })
    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0

    const admin = await createLoggedInAdmin(browser, { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId })
    const { page } = admin
    try {
      // 1. Switch off (default): the send asks for no reports and the pages say so.
      await page.goto('/sms?pageSize=100')
      const dialog = await openCreateModal(page)
      await fillCampaign(dialog, offMarker, [{ day: futureDay(), body: offMarker }])
      await submitDialog(dialog, 'Create campaign', { headingName: 'New SMS Campaign' })
      await expect(campaignRow(page, offMarker)).toBeVisible({ timeout: 15_000 })
      await clickRowAction(page, offMarker, 'Send message now')
      await page.getByRole('button', { name: 'Send Now', exact: true }).click()
      await expect(page.getByText('Message sent')).toBeVisible({ timeout: 30_000 })
      const offCall = (await waitForSmsCalls(fakeBdapps, offMarker, { sinceSeq })).at(-1)!
      expect(offCall.body.deliveryStatusRequest).toBe('0')
      const offMsg = await e2eDb().smsCampaignMessage.findFirstOrThrow({ where: { body: offMarker } })
      expect(offMsg.audienceSize).not.toBeNull()
      expect(offMsg.deliveredCount).toBeNull()

      // The list reflects the send (cache expires within a minute) and shows totals.
      await expect(async () => {
        await page.goto('/sms?pageSize=100')
        await expect(campaignRow(page, offMarker).getByTestId('campaign-totals')).toContainText('Delivery reports off')
      }).toPass({ timeout: 75_000 })
      await expect(campaignRow(page, offMarker).getByTestId('campaign-totals')).toContainText(`audience ${offMsg.audienceSize}`)
      await page.goto(`/sms/${offMsg.campaignId}`)
      const offRow = page.getByRole('row').filter({ hasText: offMarker })
      await expect(offRow.getByTestId('message-result')).toContainText(`Audience: ${offMsg.audienceSize}`)
      await expect(offRow.getByTestId('message-result')).toContainText('Delivery reports off')

      // 2. Turn the switch on in System: saved after reload and audited.
      await page.goto('/system')
      const toggle = page.getByRole('switch', { name: 'SMS delivery reports' })
      await expect(toggle).toHaveAttribute('aria-checked', 'false')
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', 'true')
      await expect(toggle).toBeEnabled()
      await page.reload()
      await expect(page.getByRole('switch', { name: 'SMS delivery reports' })).toHaveAttribute('aria-checked', 'true')
      expect((await e2eDb().systemSetting.findUniqueOrThrow({ where: { key } })).value).toBe('on')
      const log = await e2eDb().adminAuditLog.findFirst({
        where: { action: 'SET_SMS_DELIVERY_REPORTS', targetId: key },
        orderBy: { createdAt: 'desc' },
      })
      expect(log?.metadata).toMatchObject({ from: false, to: true })

      // 3. A message sent now requests reports; the webhook moves its counts.
      await page.goto('/sms?pageSize=100')
      const dialog2 = await openCreateModal(page)
      await fillCampaign(dialog2, onMarker, [{ day: futureDay(), body: onMarker }])
      await submitDialog(dialog2, 'Create campaign', { headingName: 'New SMS Campaign' })
      await expect(campaignRow(page, onMarker)).toBeVisible({ timeout: 15_000 })
      await clickRowAction(page, onMarker, 'Send message now')
      await page.getByRole('button', { name: 'Send Now', exact: true }).click()
      await expect(page.getByText('Message sent')).toBeVisible({ timeout: 30_000 })
      const onCall = (await waitForSmsCalls(fakeBdapps, onMarker, { sinceSeq })).at(-1)!
      expect(onCall.body.deliveryStatusRequest).toBe('1')
      const onMsg = await e2eDb().smsCampaignMessage.findFirstOrThrow({ where: { body: onMarker } })
      expect(onMsg).toMatchObject({ deliveredCount: 0, failedCount: 0, providerRequestId: onCall.response.requestId })

      for (const [dest, deliveryStatus] of [[maskedId, 'DELIVERED'], [`${maskedId}-b`, 'DELIVERED'], [`${maskedId}-c`, 'UNDELIVERABLE'], [`${maskedId}-d`, 'ACCEPTED']] as const) {
        const res = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
          destinationAddress: dest, requestId: onMsg.providerRequestId!, deliveryStatus, timeStamp: stamp(),
        })
        expect(res).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })
      }
      const counted = await e2eDb().smsCampaignMessage.findUniqueOrThrow({ where: { id: onMsg.id } })
      expect(counted).toMatchObject({ deliveredCount: 2, failedCount: 1 })

      await expect(async () => {
        await page.goto(`/sms/${onMsg.campaignId}`)
        await expect(page.getByRole('row').filter({ hasText: onMarker }).getByTestId('message-result')).toContainText('Delivered 2 · Failed 1')
      }).toPass({ timeout: 75_000 })
    } finally {
      await e2eDb().systemSetting.deleteMany({ where: { key } })
      await removeCampaigns(runId)
      await admin.context.close()
    }
  })
})

test.describe('Campaign detail', () => {
  test('lists every day with its text, status and send time in Bangladesh time', async ({ browser, viewport }) => {
    const runId = randomBytes(3).toString('hex')
    const adminUser = await e2eDb().user.findFirstOrThrow({ where: { role: 'ADMIN' } })
    // 2026-01-05 20:00Z is already 06 Jan 02:00 in Bangladesh: the page must print the Bangladesh date.
    const campaign = await e2eDb().smsCampaign.create({
      data: {
        name: `E2E SMS Series ${runId}`,
        createdBy: adminUser.id,
        messages: {
          create: [
            {
              day: new Date('2026-01-06T00:00:00Z'), body: `Day one ${runId}`, status: 'SENT',
              sentAt: new Date('2026-01-05T20:00:00Z'), audienceSize: 3,
            },
            { day: new Date('2026-01-08T00:00:00Z'), body: `Day two ${runId}`, status: 'FAILED', lastError: 'E2E gateway down' },
            { day: new Date('2026-01-13T00:00:00Z'), body: `Day three ${runId}`, status: 'MISSED' },
          ],
        },
      },
    })
    const admin = await createLoggedInAdmin(browser, { viewport })
    try {
      await admin.page.goto(`/sms/${campaign.id}`)
      const { page } = admin
      await expect(page.getByRole('heading', { name: `E2E SMS Series ${runId}` })).toBeVisible()
      await expect(page.getByTestId('campaign-status').getByText('Finished', { exact: true })).toBeVisible()

      const one = page.getByRole('row').filter({ hasText: `Day one ${runId}` })
      await expect(one.getByText('Jan 6, 2026', { exact: true })).toBeVisible()
      await expect(one.getByText('Sent', { exact: true })).toBeVisible()
      await expect(one.getByText('Jan 6, 2026, 02:00 AM')).toBeVisible()

      const two = page.getByRole('row').filter({ hasText: `Day two ${runId}` })
      await expect(two.getByText('Jan 8, 2026', { exact: true })).toBeVisible()
      await expect(two.getByText('Failed to send')).toBeVisible()
      await expect(two.getByText('E2E gateway down')).toBeVisible()

      const three = page.getByRole('row').filter({ hasText: `Day three ${runId}` })
      await expect(three.getByText('Missed', { exact: true })).toBeVisible()
    } finally {
      await admin.context.close()
      await e2eDb().smsCampaign.delete({ where: { id: campaign.id } })
    }
  })
})

test.describe('Campaign control', () => {
  /** Distinct far-future days for one test: the global one-per-day index must never see two alike. */
  function distinctDays(n: number): string[] {
    const days = new Set<string>()
    while (days.size < n) days.add(futureDay())
    return [...days].sort()
  }

  const stored = (day: string) => new Date(`${day}T00:00:00Z`)

  /** Keyboard activation: no hit-test, so sticky chrome or a toast over the button can't swallow it. */
  async function press(locator: import('@playwright/test').Locator) {
    await locator.scrollIntoViewIfNeeded()
    await locator.focus()
    await locator.press('Enter')
  }

  async function seedCampaign(
    name: string,
    messages: { day: string; body: string; status: 'PLANNED' | 'SENT' | 'FAILED' | 'MISSED'; lastError?: string }[],
  ) {
    const adminUser = await e2eDb().user.findFirstOrThrow({ where: { role: 'ADMIN' } })
    return e2eDb().smsCampaign.create({
      data: {
        name,
        createdBy: adminUser.id,
        messages: {
          create: messages.map((m) => ({
            day: stored(m.day),
            body: m.body,
            status: m.status,
            lastError: m.lastError,
            ...(m.status === 'SENT' ? { sentAt: new Date(), audienceSize: 2 } : {}),
          })),
        },
      },
      include: { messages: { orderBy: { day: 'asc' } } },
    })
  }

  test('cancelling mid-campaign stops the remaining days and shows "Cancelled, 1 of 3 sent"', async ({ browser, viewport }) => {
    const runId = randomBytes(3).toString('hex')
    const [d1, d2, d3] = distinctDays(3)
    const campaign = await seedCampaign(`E2E SMS Cancel ${runId}`, [
      { day: d1, body: `Cancel one ${runId}`, status: 'SENT' },
      { day: d2, body: `Cancel two ${runId}`, status: 'PLANNED' },
      { day: d3, body: `Cancel three ${runId}`, status: 'PLANNED' },
    ])
    const admin = await createLoggedInAdmin(browser, { viewport })
    try {
      const { page } = admin
      await admin.page.goto(`/sms/${campaign.id}`)
      await expect(page.getByRole('heading', { name: campaign.name })).toBeVisible()
      // A campaign that has sent a message can no longer be deleted.
      await expect(page.getByRole('button', { name: 'Delete campaign' })).toHaveCount(0)

      await press(page.getByRole('button', { name: 'Cancel campaign', exact: true }))
      const confirm = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Cancel this campaign?' }) })
      await press(confirm.getByRole('button', { name: 'Cancel campaign', exact: true }))

      await expect(page.getByTestId('campaign-cancelled-summary')).toHaveText('Cancelled, 1 of 3 sent', { timeout: 15_000 })
      await expect(page.getByTestId('campaign-status').getByText('Cancelled', { exact: true })).toBeVisible()
      const rows = await e2eDb().smsCampaignMessage.findMany({ where: { campaignId: campaign.id }, orderBy: { day: 'asc' } })
      expect(rows.map((r) => r.status)).toEqual(['SENT', 'CANCELLED', 'CANCELLED'])
      expect((await e2eDb().smsCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).cancelledAt).not.toBeNull()
      expect(await e2eDb().adminAuditLog.count({ where: { action: 'CANCEL_SMS_CAMPAIGN', targetId: campaign.id } })).toBe(1)
      // No controls are left on a cancelled campaign.
      await expect(page.getByRole('button', { name: 'Add day' })).toHaveCount(0)
    } finally {
      await admin.context.close()
      await removeCampaigns(runId)
    }
  })

  test('an unsent message can be edited and a sent one is locked; a clashing added day is refused, a free one accepted', async ({
    browser,
    viewport,
  }) => {
    const runId = randomBytes(3).toString('hex')
    const [d1, d2, clash, free] = distinctDays(4)
    const campaign = await seedCampaign(`E2E SMS Run ${runId}`, [
      { day: d1, body: `Run one ${runId}`, status: 'SENT' },
      { day: d2, body: `Run two ${runId}`, status: 'PLANNED' },
    ])
    const holder = await seedCampaign(`E2E SMS Holder ${runId}`, [{ day: clash, body: `Holder ${runId}`, status: 'PLANNED' }])
    const admin = await createLoggedInAdmin(browser, { viewport })
    try {
      const { page } = admin
      await page.goto(`/sms/${campaign.id}`)
      const sentRow = page.getByRole('row').filter({ hasText: `Run one ${runId}` })
      const plannedRow = page.getByRole('row').filter({ hasText: `Run two ${runId}` })
      await expect(sentRow).toBeVisible()
      await expect(sentRow.getByRole('button', { name: /^Edit message/ })).toHaveCount(0)

      await press(plannedRow.getByRole('button', { name: /^Edit message/ }))
      const edit = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit message' }) })
      await edit.getByLabel('Message', { exact: true }).fill(`Run two edited ${runId}`)
      await press(edit.getByRole('button', { name: 'Save changes' }))
      await expect(page.getByRole('row').filter({ hasText: `Run two edited ${runId}` })).toBeVisible({ timeout: 15_000 })

      // A clashing day is refused inline, naming the other campaign; nothing is added.
      await press(page.getByRole('button', { name: 'Add day' }))
      const add = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Add a day' }) })
      await add.getByLabel('Day (Bangladesh)').fill(clash)
      await add.getByLabel('New message').fill(`Run three ${runId}`)
      await press(add.getByRole('button', { name: 'Add day', exact: true }))
      await expect(add.getByRole('alert')).toContainText(holder.name, { timeout: 15_000 })
      expect(await e2eDb().smsCampaignMessage.count({ where: { campaignId: campaign.id } })).toBe(2)

      // A free day is accepted.
      await add.getByLabel('Day (Bangladesh)').fill(free)
      await press(add.getByRole('button', { name: 'Add day', exact: true }))
      await expect(page.getByRole('row').filter({ hasText: `Run three ${runId}` })).toBeVisible({ timeout: 15_000 })
      expect(await e2eDb().smsCampaignMessage.count({ where: { campaignId: campaign.id } })).toBe(3)
      expect(await e2eDb().adminAuditLog.count({ where: { action: 'ADD_SMS_MESSAGE', targetId: { in: (await e2eDb().smsCampaignMessage.findMany({ where: { campaignId: campaign.id }, select: { id: true } })).map((m) => m.id) } } })).toBe(1)
    } finally {
      await admin.context.close()
      await removeCampaigns(runId)
    }
  })

  test('a failed day is skipped without moving later days, and can be resent on a free day', async ({ browser, viewport }) => {
    const runId = randomBytes(3).toString('hex')
    const [d1, d2, d3, free] = distinctDays(4)
    const campaign = await seedCampaign(`E2E SMS Resend ${runId}`, [
      { day: d1, body: `Resend one ${runId}`, status: 'FAILED', lastError: 'E2E gateway down' },
      { day: d2, body: `Resend two ${runId}`, status: 'PLANNED' },
      { day: d3, body: `Resend three ${runId}`, status: 'PLANNED' },
    ])
    const admin = await createLoggedInAdmin(browser, { viewport })
    try {
      const { page } = admin
      await page.goto(`/sms/${campaign.id}`)
      const failedRow = page.getByRole('row').filter({ hasText: `Resend one ${runId}` })
      await press(failedRow.getByRole('button', { name: /^Resend message/ }))
      const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Resend on a free day' }) })

      // A taken day is refused inline.
      await dialog.getByLabel('Free day (Bangladesh)').fill(d2)
      await press(dialog.getByRole('button', { name: 'Plan on this day' }))
      await expect(dialog.getByRole('alert')).toContainText(campaign.name, { timeout: 15_000 })

      await dialog.getByLabel('Free day (Bangladesh)').fill(free)
      await press(dialog.getByRole('button', { name: 'Plan on this day' }))
      await expect(page.getByRole('row').filter({ hasText: `Resend one ${runId}` })).toHaveCount(2, { timeout: 15_000 })

      const rows = await e2eDb().smsCampaignMessage.findMany({ where: { campaignId: campaign.id }, orderBy: { day: 'asc' } })
      expect(rows.map((r) => [r.day.toISOString().slice(0, 10), r.status])).toEqual(
        [[d1, 'FAILED'], [d2, 'PLANNED'], [d3, 'PLANNED'], [free, 'PLANNED']].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      )
      expect(await e2eDb().adminAuditLog.count({ where: { action: 'RESEND_SMS_MESSAGE', targetId: rows.find((r) => r.status === 'FAILED')!.id } })).toBe(1)
    } finally {
      await admin.context.close()
      await removeCampaigns(runId)
    }
  })

  test('an unsent message can be removed after a confirm; the last one and failed ones cannot', async ({ browser, viewport }) => {
    const runId = randomBytes(3).toString('hex')
    const [d1, d2, d3] = distinctDays(3)
    const campaign = await seedCampaign(`E2E SMS Remove ${runId}`, [
      { day: d1, body: `Remove failed ${runId}`, status: 'FAILED', lastError: 'E2E gateway down' },
      { day: d2, body: `Remove keep ${runId}`, status: 'PLANNED' },
      { day: d3, body: `Remove drop ${runId}`, status: 'PLANNED' },
    ])
    const admin = await createLoggedInAdmin(browser, { viewport })
    try {
      const { page } = admin
      await page.goto(`/sms/${campaign.id}`)
      // A failed day is resent, never edited, moved or removed in place.
      const failedRow = page.getByRole('row').filter({ hasText: `Remove failed ${runId}` })
      await expect(failedRow.getByRole('button', { name: /^Resend message/ })).toBeVisible()
      for (const name of [/^Edit message/, /^Move message/, /^Remove message/]) {
        await expect(failedRow.getByRole('button', { name })).toHaveCount(0)
      }

      const dropRow = page.getByRole('row').filter({ hasText: `Remove drop ${runId}` })
      const confirm = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Remove this message?' }) })
      // Cancelling the confirm keeps the message.
      await press(dropRow.getByRole('button', { name: /^Remove message/ }))
      await press(confirm.getByRole('button', { name: 'Cancel', exact: true }))
      await expect(page.getByRole('heading', { name: 'Remove this message?' })).toHaveCount(0)
      expect(await e2eDb().smsCampaignMessage.count({ where: { campaignId: campaign.id } })).toBe(3)

      await press(dropRow.getByRole('button', { name: /^Remove message/ }))
      await press(confirm.getByRole('button', { name: 'Remove', exact: true }))
      await expect(page.getByRole('heading', { name: 'Remove this message?' })).toHaveCount(0, { timeout: 15_000 })
      await expect(dropRow).toHaveCount(0, { timeout: 15_000 })
      const rows = await e2eDb().smsCampaignMessage.findMany({ where: { campaignId: campaign.id }, orderBy: { day: 'asc' } })
      expect(rows.map((r) => r.day.toISOString().slice(0, 10))).toEqual([d1, d2])
      expect(await e2eDb().adminAuditLog.count({ where: { action: 'REMOVE_SMS_MESSAGE', metadata: { path: ['campaignId'], equals: campaign.id } } })).toBe(1)
    } finally {
      await admin.context.close()
      await removeCampaigns(runId)
    }
  })

  test('a campaign with nothing sent can be deleted from its page', async ({ browser, viewport }) => {
    const runId = randomBytes(3).toString('hex')
    const [d1] = distinctDays(1)
    const campaign = await seedCampaign(`E2E SMS Drop ${runId}`, [{ day: d1, body: `Drop ${runId}`, status: 'PLANNED' }])
    const admin = await createLoggedInAdmin(browser, { viewport })
    try {
      const { page } = admin
      await page.goto(`/sms/${campaign.id}`)
      await press(page.getByRole('button', { name: 'Delete campaign' }))
      const confirm = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Delete this campaign?' }) })
      await press(confirm.getByRole('button', { name: 'Delete', exact: true }))
      await expect(page).toHaveURL(/\/sms$/, { timeout: 15_000 })
      expect(await e2eDb().smsCampaign.count({ where: { id: campaign.id } })).toBe(0)
      expect(await e2eDb().adminAuditLog.count({ where: { action: 'DELETE_SMS_CAMPAIGN', targetId: campaign.id } })).toBe(1)
    } finally {
      await admin.context.close()
      await removeCampaigns(runId)
    }
  })
})

test.describe('Server render', () => {
  test('SMS page hydrates when a message was sent between 18:00Z and 24:00Z', async ({ browser, days, viewport }) => {
    // 18:00Z is 00:00 Bangladesh: server (UTC) and browser (Asia/Dhaka) must print the same date.
    // FAILED so no cron picks this row up.
    const marker = `E2E SMS hydrate ${randomBytes(3).toString('hex')}`
    const adminUser = await e2eDb().user.findFirstOrThrow({ where: { role: 'ADMIN' } })
    const instant = days.startOf(days.daysAgo(3))
    const bdDay = new Date(instant.getTime() + 6 * 3_600_000).toISOString().slice(0, 10)
    const campaign = await e2eDb().smsCampaign.create({
      data: {
        name: marker,
        createdBy: adminUser.id,
        messages: {
          create: {
            day: new Date(`${bdDay}T00:00:00Z`),
            body: marker,
            status: 'FAILED',
            sentAt: instant,
            sendAttempts: 1,
            lastError: 'E2E hydrate row',
          },
        },
      },
    })
    const admin = await createLoggedInAdmin(browser, { viewport })

    const reactErrors: string[] = []
    admin.page.on('pageerror', (e) => {
      if (/Minified React error #(418|423|425)|hydrat/i.test(e.message)) reactErrors.push(e.message)
    })
    try {
      // The /sms list is cached (60 s); bust it, then reload so the server renders the new row.
      await admin.page.goto('/sms?pageSize=100')
      await admin.page.getByRole('button', { name: 'Refresh data' }).click()
      await expect(campaignRow(admin.page, marker)).toBeVisible()
      await admin.page.reload()
      await expect(campaignRow(admin.page, marker)).toBeVisible()
      await admin.page.goto(`/sms/${campaign.id}`)
      await expect(admin.page.getByRole('row').filter({ hasText: marker })).toBeVisible()
      await admin.page.waitForLoadState('networkidle')
      expect(reactErrors).toEqual([])
    } finally {
      await admin.context.close()
      await e2eDb().smsCampaign.delete({ where: { id: campaign.id } })
    }
  })
})

/** Import a campaign from CSV, and search the whole campaign history (#201). */
test.describe('Campaign CSV import and search', () => {
  test('a valid CSV becomes one campaign with a message per row; an invalid row rejects the whole file inline', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.setTimeout(150_000)
    const runId = randomBytes(3).toString('hex')
    const name = `E2E SMS Import ${runId}`
    const badName = `E2E SMS Import Bad ${runId}`
    const dayA = futureDay()
    let dayB = futureDay()
    while (dayB === dayA) dayB = futureDay()
    const csv = (rows: string[]) => Buffer.from(['day,text', ...rows].join('\n'))

    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page }) => {
          const importInto = async (campaignName: string, file: Buffer) => {
            const dialog = await openCreateModal(page)
            await dialog.getByRole('tab', { name: 'Import CSV' }).dispatchEvent('click')
            await dialog.getByLabel('Campaign name').fill(campaignName)
            await dialog.getByLabel('CSV file').setInputFiles({ name: 'campaign.csv', mimeType: 'text/csv', buffer: file })
            await expect(dialog.getByText('Selected: campaign.csv')).toBeVisible()
            await dialog.getByRole('button', { name: 'Import campaign', exact: true }).dispatchEvent('click')
            return dialog
          }

          // One invalid row (a past day) refuses the whole file, naming the line; nothing is created.
          const dialog = await importInto(badName, csv([`${dayA},"fine, ${runId}"`, `2020-01-01,too old ${runId}`]))
          await expect(dialog.getByRole('alert')).toContainText('Line 3', { timeout: 15_000 })
          await expect(dialog.getByRole('alert')).toContainText(/past/i)
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toBeVisible()
          expect(await e2eDb().smsCampaign.count({ where: { name: { contains: runId } } })).toBe(0)

          // Fix the file: one campaign, one message per row, and an audit row.
          await dialog.getByLabel('CSV file').setInputFiles({
            name: 'campaign.csv',
            mimeType: 'text/csv',
            buffer: csv([`${dayA},"one, ${runId}"`, `${dayB},দুই ${runId}`]),
          })
          await dialog.getByLabel('Campaign name').fill(name)
          await dialog.getByRole('button', { name: 'Import campaign', exact: true }).dispatchEvent('click')
          // The row can render before the dialog closes; wait for the close before anything reopens it.
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0, { timeout: 15_000 })
          await expect(campaignRow(page, name)).toBeVisible({ timeout: 15_000 })

          const campaign = await e2eDb().smsCampaign.findFirstOrThrow({
            where: { name },
            include: { messages: { orderBy: { day: 'asc' } } },
          })
          expect(campaign.messages).toHaveLength(2)
          expect(campaign.messages.map((m) => m.body).sort()).toEqual([`one, ${runId}`, `দুই ${runId}`].sort())
          const audit = await e2eDb().adminAuditLog.findFirst({
            where: { action: 'IMPORT_SMS_CAMPAIGN', targetId: campaign.id },
          })
          expect(audit).not.toBeNull()
        },
      )
    } finally {
      await removeCampaigns(runId)
      await e2eDb().adminAuditLog.deleteMany({ where: { action: 'IMPORT_SMS_CAMPAIGN', metadata: { path: ['name'], string_contains: runId } } })
    }
  })

  test('search finds a campaign by name or message text even when it is not on the first page', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.setTimeout(150_000)
    const runId = randomBytes(3).toString('hex')
    const target = `E2E SMS Needle ${runId}`
    const filler = `E2E SMS Filler ${runId}`

    try {
      await withAdminPage(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async ({ page, id }) => {
          const db = e2eDb()
          // The target is the oldest campaign, then more than a page of newer ones push it off page 1.
          const targetDay = futureDay()
          await db.smsCampaign.create({
            data: {
              name: target,
              createdBy: id,
              createdAt: new Date(Date.now() - 60_000),
              messages: { create: [{ day: new Date(`${targetDay}T00:00:00.000Z`), body: `body marker ${runId}` }] },
            },
          })
          await db.smsCampaign.createMany({
            data: Array.from({ length: 25 }, (_, i) => ({ name: `${filler} ${i}`, createdBy: id })),
          })

          await page.goto('/sms?pageSize=10')
          await expect(page.getByRole('heading', { name: 'SMS Campaigns' })).toBeVisible()
          await expect(campaignRow(page, filler).first()).toBeVisible({ timeout: 15_000 })
          await expect(campaignRow(page, target)).toHaveCount(0)

          // By name: kept in the URL, found server-side, the filler rows are gone.
          const search = page.getByPlaceholder('Search campaigns…')
          await search.fill(`Needle ${runId}`)
          await expect(page).toHaveURL(new RegExp(`q=`), { timeout: 15_000 })
          await expect(campaignRow(page, target)).toBeVisible({ timeout: 15_000 })
          await expect(campaignRow(page, filler)).toHaveCount(0)

          // By message text, also across pages.
          await search.fill(`body marker ${runId}`)
          await expect(campaignRow(page, target)).toBeVisible({ timeout: 15_000 })

          // The URL restores the search on a fresh load.
          await page.goto(`/sms?pageSize=10&q=${encodeURIComponent(`Needle ${runId}`)}`)
          await expect(campaignRow(page, target)).toBeVisible({ timeout: 15_000 })
          await expect(page.getByPlaceholder('Search campaigns…')).toHaveValue(`Needle ${runId}`)
          await expect(campaignRow(page, filler)).toHaveCount(0)
        },
      )
    } finally {
      await removeCampaigns(runId)
    }
  })
})
