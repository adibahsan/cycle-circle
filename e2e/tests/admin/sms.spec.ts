/**
 * Admin SMS broadcasting (#129).
 *
 * Production send uses BDApps `destinationAddresses: ['tel:all']` (all subscribers),
 * with one composed body from the broadcast's `sendLanguage` — not per-user language
 * (see #143). Assertions are scoped to unique message markers and throwaway subscribers;
 * other parallel tests may also hit `/sms/send`.
 *
 * Delivery-report coverage is the webhook path kept for a plan change; prod sends with
 * `deliveryStatusRequest: 0` because reports are disabled (E1312).
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

/** Poll cron until our scheduled marker appears at the fake (other due broadcasts may go first). */
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
  throw new Error(`cron never dispatched broadcast containing ${JSON.stringify(marker)}`)
}

async function openCreateModal(page: import('@playwright/test').Page) {
  const newBtn = page.getByRole('button', { name: 'New Broadcast' })
  const heading = page.getByRole('heading', { name: 'New SMS Broadcast' })
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

async function fillBilingualDraft(
  dialog: import('@playwright/test').Locator,
  en: string,
  bn: string,
  opts: { scheduleLocal?: string; language?: 'Bengali + English' | 'Bengali only' | 'English only' } = {},
) {
  await dialog.getByLabel('Message (English)').fill(en)
  await dialog.getByLabel(/Message \(Bengali\)/).fill(bn)
  if (opts.language && opts.language !== 'Bengali + English') {
    // Label wraps an sr-only radio; the visible label is the clickable control. Click until the
    // radio is checked: on the phone project a click right after the dialog opens was once lost.
    const label = dialog.getByText(opts.language, { exact: true })
    const radio = dialog.getByRole('radio', { name: opts.language })
    await expect(async () => {
      if (!(await radio.isChecked())) await label.click({ timeout: 2_000 })
      await expect(radio).toBeChecked({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
  }
  if (opts.scheduleLocal) {
    await dialog.getByLabel('Schedule date and time').fill(opts.scheduleLocal)
    await dialog.getByLabel('Schedule date and time').blur()
  }
}

/** Table row for a broadcast (message cell). Prefer role=row after the create dialog closes. */
function broadcastRow(page: import('@playwright/test').Page, marker: string) {
  return page.getByRole('row').filter({ hasText: marker })
}

/**
 * Action column sits under sticky pagination / overlapping cells on the phone
 * project's narrow horizontal table — keyboard activation sidesteps the overlap (a viewport
 * layout quirk, not a missing accessible control).
 */
async function clickRowAction(page: import('@playwright/test').Page, marker: string, name: string) {
  const btn = broadcastRow(page, marker).getByRole('button', { name })
  await btn.scrollIntoViewIfNeeded()
  await btn.focus()
  await btn.press('Enter')
}

async function filterStatusSent(page: import('@playwright/test').Page) {
  await page.getByRole('combobox', { name: 'Status:' }).click()
  // exact: "Queue (unsent)" also contains the substring "Sent"
  await page.getByRole('option', { name: 'Sent', exact: true }).click()
  await expect(page).toHaveURL(/status=SENT/)
  await page.getByRole('button', { name: 'Refresh data' }).click()
}

test.describe('Admin SMS broadcasting', () => {
  test('BOTH send language reaches BDApps as composed EN+BN text (tel:all; scoped by marker)', async ({
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
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    try {
      const { page } = admin
      await page.goto('/sms?pageSize=100')
      await expect(page.getByRole('heading', { name: 'SMS Broadcasts' })).toBeVisible()

      const dialog = await openCreateModal(page)
      await fillBilingualDraft(dialog, enMarker, bnMarker)
      // Default send language is Bengali + English (BOTH).
      await dialog.getByRole('button', { name: 'Save as Draft' }).click()
      await expect(page.getByRole('heading', { name: 'New SMS Broadcast' })).toHaveCount(0)
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

      await clickRowAction(page, enMarker, 'Send broadcast')
      await expect(page.getByRole('heading', { name: 'Send Broadcast Now?' })).toBeVisible()
      await page.getByRole('button', { name: 'Send Now', exact: true }).click()
      await expect(page.getByText('Broadcast sent')).toBeVisible({ timeout: 30_000 })

      // Note: destination is tel:all (all subscribers). Scope by unique message text only.
      const mine = await waitForSmsCalls(fakeBdapps, enMarker, { sinceSeq })
      expect(mine.length).toBeGreaterThanOrEqual(1)
      const last = mine[mine.length - 1]
      expect(last.body.destinationAddresses).toEqual(['tel:all'])
      expect(last.body.message).toBe(`${enMarker}\n${bnMarker}`)
      expect(last.response).toMatchObject({ statusCode: 'S1000' })
      expect(last.response.requestId).toBeTruthy()

      await filterStatusSent(page)
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })
      await expect(broadcastRow(page, enMarker).getByText('Sent', { exact: true })).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('Bengali-only send reaches BDApps as BN body only', async ({
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
    const enMarker = `E2E SMS BN-only EN ${runId}`
    const bnMarker = `E2E SMS BN-only BN ${runId}`
    await newUser()

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    try {
      const { page } = admin
      await page.goto('/sms?pageSize=100')
      await expect(page.getByRole('heading', { name: 'SMS Broadcasts' })).toBeVisible()

      const dialog = await openCreateModal(page)
      await fillBilingualDraft(dialog, enMarker, bnMarker, { language: 'Bengali only' })
      await dialog.getByRole('button', { name: 'Save as Draft' }).click()
      await expect(page.getByRole('heading', { name: 'New SMS Broadcast' })).toHaveCount(0)
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

      await clickRowAction(page, enMarker, 'Send broadcast')
      await page.getByRole('button', { name: 'Send Now', exact: true }).click()
      await expect(page.getByText('Broadcast sent')).toBeVisible({ timeout: 30_000 })

      const mine = await waitForSmsCalls(fakeBdapps, bnMarker, { sinceSeq })
      const last = mine[mine.length - 1]
      expect(last.body.destinationAddresses).toEqual(['tel:all'])
      expect(last.body.message).toBe(bnMarker)
      expect(last.body.message).not.toContain(enMarker)
      expect(last.response).toMatchObject({ statusCode: 'S1000' })
    } finally {
      await admin.context.close()
    }
  })

  test('scheduled broadcast goes out when daily-reminders cron runs after due time', async ({
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
    const enMarker = `E2E SMS Sched ${runId}`
    const bnMarker = `E2E SMS Sched BN ${runId}`
    const subscriber = await newUser() // ensure at least one REGISTERED subscriber for tel:all
    const cronUser = await e2eDb().user.findUniqueOrThrow({
      where: { phone: toDbPhone(subscriber.phone) },
      select: { id: true },
    })

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    try {
      const { page, context } = admin
      await page.goto('/sms?pageSize=100')
      await expect(page.getByRole('heading', { name: 'SMS Broadcasts' })).toBeVisible()

      const dialog = await openCreateModal(page)
      // Past local time: DateTimePicker text entry does not enforce minDate (calendar does).
      await fillBilingualDraft(dialog, enMarker, bnMarker, { scheduleLocal: '2020-06-15 09:00' })
      // exact: "Reschedule broadcast" aria-labels also match a substring "Schedule Broadcast"
      await dialog.getByRole('button', { name: 'Schedule Broadcast', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'New SMS Broadcast' })).toHaveCount(0)
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })
      await expect(broadcastRow(page, enMarker).getByText('Scheduled')).toBeVisible()

      const mine = await dispatchUntilMarker(
        context.request,
        fakeBdapps,
        enMarker,
        sinceSeq,
        cronUser.id,
      )
      expect(mine[mine.length - 1].body.message).toBe(`${enMarker}\n${bnMarker}`)
      expect(mine[mine.length - 1].body.destinationAddresses).toEqual(['tel:all'])

      await filterStatusSent(page)
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })
    } finally {
      // Leave no past-due SCHEDULED row for later cron polls in this slot.
      await e2eDb().smsBroadcast.deleteMany({ where: { message: enMarker } })
      await admin.context.close()
    }
  })

  test('a scripted BDApps failure is retried and the broadcast ends Sent', async ({
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
    // Retry + 45 s send wait + 45 s fake poll: more than the 60 s default on a CI runner.
    test.setTimeout(150_000)
    const enMarker = `E2E SMS Retry ${runId}`
    const bnMarker = `E2E SMS Retry BN ${runId}`
    await newUser()

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    try {
      const { page } = admin
      await page.goto('/sms?pageSize=100')
      await expect(page.getByRole('heading', { name: 'SMS Broadcasts' })).toBeVisible()

      const dialog = await openCreateModal(page)
      await fillBilingualDraft(dialog, enMarker, bnMarker)
      await dialog.getByRole('button', { name: 'Save as Draft' }).click()
      await expect(page.getByRole('heading', { name: 'New SMS Broadcast' })).toHaveCount(0)
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

      // messageContains scopes tel:all failures so parallel workers cannot steal this one.
      await fakeBdapps.failNext('/sms/send', {
        match: { messageContains: enMarker },
        mode: 'error',
        statusCode: 'E1601',
        times: 1,
      })

      await clickRowAction(page, enMarker, 'Send broadcast')
      await page.getByRole('button', { name: 'Send Now', exact: true }).click()
      await expect(page.getByText('Broadcast sent')).toBeVisible({ timeout: 45_000 })

      const mine = await waitForSmsCalls(fakeBdapps, enMarker, { sinceSeq, min: 2, timeoutMs: 45_000 })
      expect(mine.length).toBeGreaterThanOrEqual(2)
      expect(mine[0].response).toMatchObject({ statusCode: 'E1601' })
      expect(mine[mine.length - 1].response).toMatchObject({ statusCode: 'S1000' })
      expect(mine[mine.length - 1].body.message).toContain(enMarker)

      const dbRow = await e2eDb().smsBroadcast.findFirst({ where: { message: enMarker } })
      expect(dbRow?.status).toBe('SENT')
      expect(dbRow?.lastError).toBeNull()
    } finally {
      await admin.context.close()
    }
  })

  test('delivery-report webhook updates delivered/failed counts (webhook path; prod E1312)', async ({
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
    const bnMarker = `E2E SMS Report BN ${runId}`
    const recipient = await newUser()
    const maskedId = (await fakeBdapps.subscriber(recipient.phone))!.maskedId

    const sinceSeq = (await fakeBdapps.calls({ path: '/sms/send' })).at(-1)?.seq ?? 0
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    try {
      const { page } = admin
      await page.goto('/sms?pageSize=100')
      await expect(page.getByRole('heading', { name: 'SMS Broadcasts' })).toBeVisible()

      const dialog = await openCreateModal(page)
      await fillBilingualDraft(dialog, enMarker, bnMarker, { language: 'English only' })
      await dialog.getByRole('button', { name: 'Save as Draft' }).click()
      await expect(page.getByRole('heading', { name: 'New SMS Broadcast' })).toHaveCount(0)
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })

      await clickRowAction(page, enMarker, 'Send broadcast')
      await page.getByRole('button', { name: 'Send Now', exact: true }).click()
      await expect(page.getByText('Broadcast sent')).toBeVisible({ timeout: 30_000 })

      const mine = await waitForSmsCalls(fakeBdapps, enMarker, { sinceSeq })
      // English only — Bengali marker must not appear.
      expect(mine[mine.length - 1].body.message).toBe(enMarker)
      expect(mine[mine.length - 1].body.message).not.toContain(bnMarker)

      const destResponses = mine[mine.length - 1].response.destinationResponses as
        | Array<{ messageId?: string }>
        | undefined
      const fakeMessageId = destResponses?.[0]?.messageId
      expect(fakeMessageId).toBeTruthy()

      const broadcast = await e2eDb().smsBroadcast.findFirstOrThrow({ where: { message: enMarker } })
      expect(broadcast.status).toBe('SENT')
      expect(broadcast.deliveredCount ?? 0).toBe(0)
      // App stores destination messageId as providerMessageId; webhook correlates on requestId.
      expect(broadcast.providerMessageId).toBe(fakeMessageId)

      const delivered = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
        destinationAddress: maskedId,
        requestId: broadcast.providerMessageId!,
        deliveryStatus: 'DELIVERED',
        timeStamp: stamp(),
      })
      expect(delivered).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

      const afterDelivered = await e2eDb().smsBroadcast.findUniqueOrThrow({ where: { id: broadcast.id } })
      expect(afterDelivered.deliveredCount).toBe(1)
      expect(afterDelivered.targetCount).toBe(1)
      expect(afterDelivered.failedCount ?? 0).toBe(0)

      const failed = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
        destinationAddress: `${maskedId}-other`,
        requestId: broadcast.providerMessageId!,
        deliveryStatus: 'FAILED',
        timeStamp: stamp(),
      })
      expect(failed).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

      const afterFailed = await e2eDb().smsBroadcast.findUniqueOrThrow({ where: { id: broadcast.id } })
      expect(afterFailed.failedCount).toBe(1)
      expect(afterFailed.targetCount).toBe(2)
      expect(afterFailed.deliveredCount).toBe(1)

      // Reload: Sent stays visible and the Delivery column shows the webhook-updated counts (#144).
      // Do not assert Active — content-override clears it when a parallel worker sends later.
      await page.goto('/sms?status=SENT&pageSize=100')
      await expect(page.getByRole('heading', { name: 'SMS Broadcasts' })).toBeVisible()
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })
      await expect(broadcastRow(page, enMarker).getByText('Sent', { exact: true })).toBeVisible()
      // The webhook runs in the web app and can't clear the admin's cached list (5 min), so refresh.
      await page.getByRole('button', { name: 'Refresh data' }).click()
      await expect(broadcastRow(page, enMarker).getByText('Delivered 1 · Failed 1')).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })
  // The #145 unknown-requestId test lives in tests/web/webhooks-bdapps.spec.ts (serial `cron` project):
  // its fallback lands on whichever broadcast is active, so in this parallel file it corrupted
  // another test's counts and passed unexpectedly.
})

test.describe('Server render', () => {
  test('SMS page hydrates when a broadcast was scheduled and sent between 18:00Z and 24:00Z', async ({
    browser,
    days,
    viewport,
  }) => {
    // 18:00Z is 00:00 Bangladesh: server (UTC) and browser (Asia/Dhaka) must print the same date.
    // FAILED + inactive so no cron or "latest content" logic picks this row up.
    const marker = `E2E SMS hydrate ${randomBytes(3).toString('hex')}`
    const adminUser = await e2eDb().user.findFirstOrThrow({ where: { role: 'ADMIN' } })
    const instant = days.startOf(days.daysAgo(3))
    const row = await e2eDb().smsBroadcast.create({
      data: {
        message: marker,
        sendLanguage: 'EN',
        status: 'FAILED',
        active: false,
        scheduledFor: instant,
        sentAt: instant,
        sendAttempts: 3,
        lastError: 'E2E hydrate row',
        createdBy: adminUser.id,
      },
    })
    const admin = await createLoggedInAdmin(browser, { viewport })

    const reactErrors: string[] = []
    admin.page.on('pageerror', (e) => {
      if (/Minified React error #(418|423|425)|hydrat/i.test(e.message)) reactErrors.push(e.message)
    })
    try {
      await admin.page.goto('/sms?pageSize=100')
      await expect(broadcastRow(admin.page, marker)).toBeVisible()
      await admin.page.waitForLoadState('networkidle')
      expect(reactErrors).toEqual([])
    } finally {
      await admin.context.close()
      await e2eDb().smsBroadcast.delete({ where: { id: row.id } })
    }
  })
})
