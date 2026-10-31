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
          await dialog.getByRole('button', { name: 'Create campaign', exact: true }).click()
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
          await dialog.getByRole('button', { name: 'Create campaign', exact: true }).click()
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
          await dialog.getByRole('button', { name: 'Create campaign', exact: true }).click()
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
          await dialog.getByRole('button', { name: 'Create campaign', exact: true }).click()
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
          await dialog.getByRole('button', { name: 'Create campaign', exact: true }).click()
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
          await dialog.getByRole('button', { name: 'Create campaign', exact: true }).click()
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
          await dialog.getByRole('button', { name: 'Create campaign', exact: true }).click()
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0)
          await expect(campaignRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

          await clickRowAction(page, enMarker, 'Edit message')
          const edit = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit message' }) })
          await edit.getByLabel('Message', { exact: true }).fill(edited)
          await edit.getByRole('button', { name: 'Save changes' }).click()
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
          await dialog.getByRole('button', { name: 'Create campaign', exact: true }).click()
          // The new row can render (refreshed with the action's response) a moment before the dialog
          // closes; wait for the close, or the next "open" would reuse this dialog and its values.
          await expect(page.getByRole('heading', { name: 'New SMS Campaign' })).toHaveCount(0, { timeout: 15_000 })
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
