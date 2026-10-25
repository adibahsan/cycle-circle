/**
 * Admin SMS broadcasting (#129).
 *
 * Production send uses BDApps `destinationAddresses: ['tel:all']` (all subscribers),
 * with one composed body from the broadcast's `sendLanguage` — not per-user language.
 * Assertions are scoped to unique message markers and throwaway subscribers we create;
 * other parallel tests may also hit `/sms/send`.
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
): Promise<{ status: number; json: unknown }> {
  const res = await request.post(`${URLS.web}/api/cron/daily-reminders`, {
    headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
    data: { overrideDisabled: true },
  })
  return { status: res.status(), json: await res.json().catch(() => null) }
}

/** Poll cron until our scheduled marker appears at the fake (other due broadcasts may go first). */
async function dispatchUntilMarker(
  request: import('@playwright/test').APIRequestContext,
  fake: FakeBdappsClient,
  marker: string,
  sinceSeq: number,
): Promise<RecordedCall[]> {
  for (let i = 0; i < 12; i++) {
    const cron = await triggerDailyRemindersCron(request)
    expect(cron.status).toBe(200)
    const mine = smsCallsWithMarker(await fake.calls({ path: '/sms/send', sinceSeq }), marker)
    if (mine.length >= 1) return mine
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`cron never dispatched broadcast containing ${JSON.stringify(marker)}`)
}

async function openCreateModal(page: import('@playwright/test').Page) {
  const newBtn = page.getByRole('button', { name: 'New Broadcast' })
  await newBtn.scrollIntoViewIfNeeded()
  // Phone: chart canvases / sticky chrome intercept the first click (button focuses, modal never opens).
  await newBtn.click({ force: true })
  const heading = page.getByRole('heading', { name: 'New SMS Broadcast' })
  if (!(await heading.isVisible().catch(() => false))) {
    await newBtn.click({ force: true })
  }
  await expect(heading).toBeVisible({ timeout: 15_000 })
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
    // Label wraps an sr-only radio; click the visible label (radio itself is intercepted).
    await dialog.locator('label').filter({ hasText: opts.language }).click()
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
 * project's narrow horizontal table — force the click after scrolling.
 */
async function clickRowAction(page: import('@playwright/test').Page, marker: string, name: string) {
  const btn = broadcastRow(page, marker).getByRole('button', { name })
  await btn.scrollIntoViewIfNeeded()
  await btn.click({ force: true })
}

async function filterStatusSent(page: import('@playwright/test').Page) {
  await page.getByRole('combobox', { name: 'Status:' }).click()
  // exact: "Queue (unsent)" also contains the substring "Sent"
  await page.getByRole('option', { name: 'Sent', exact: true }).click()
  await expect(page).toHaveURL(/status=SENT/)
  await page.getByRole('button', { name: 'Refresh data' }).click()
}

test.describe('Admin SMS broadcasting', () => {
  test('bilingual send reaches BDApps as composed BOTH text (tel:all; scoped by marker)', async ({
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
    test.setTimeout(90_000)
    const runId = randomBytes(3).toString('hex')
    const enMarker = `E2E SMS EN ${runId}`
    const bnMarker = `E2E SMS BN ${runId}`
    // Throwaway subscribers so tel:all expansion includes our numbers (other slots/tests also send SMS).
    const enUser = await newUser()
    const bnUser = await newUser()
    await e2eDb().user.update({
      where: { phone: toDbPhone(enUser.phone) },
      data: { language: 'EN', fullName: `E2E SMS EN u ${runId}` },
    })
    await e2eDb().user.update({
      where: { phone: toDbPhone(bnUser.phone) },
      data: { language: 'BN', fullName: `E2E SMS BN u ${runId}` },
    })
    expect(await fakeBdapps.subscriber(enUser.phone)).toMatchObject({ status: 'REGISTERED' })
    expect(await fakeBdapps.subscriber(bnUser.phone)).toMatchObject({ status: 'REGISTERED' })

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
    await newUser() // ensure at least one REGISTERED subscriber for tel:all

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

      const mine = await dispatchUntilMarker(context.request, fakeBdapps, enMarker, sinceSeq)
      expect(mine[mine.length - 1].body.message).toBe(`${enMarker}\n${bnMarker}`)
      expect(mine[mine.length - 1].body.destinationAddresses).toEqual(['tel:all'])

      await filterStatusSent(page)
      await expect(broadcastRow(page, enMarker)).toBeVisible({ timeout: 15_000 })
    } finally {
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
  }, testInfo) => {
    // failNext match is destinationAddress tel:all — shared by every broadcast send.
    // Desktop only so the phone worker cannot steal this failure mid-send.
    test.skip(testInfo.project.name.endsWith('-phone'), 'tel:all failNext is exclusive to one worker')

    const runId = randomBytes(3).toString('hex')
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

      // Scoped match — never { any: true }. times:1 → service retries once (backoff ~1s).
      await fakeBdapps.failNext('/sms/send', {
        match: { destinationAddress: 'tel:all' },
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

  test('delivery-report webhook updates deliveredCount on the active sent broadcast', async ({
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
    test.setTimeout(90_000)
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

      const broadcast = await e2eDb().smsBroadcast.findFirstOrThrow({ where: { message: enMarker } })
      expect(broadcast.status).toBe('SENT')
      expect(broadcast.deliveredCount ?? 0).toBe(0)
      // App stores destination messageId as providerMessageId; webhook correlates on requestId.
      const providerId = broadcast.providerMessageId
      expect(providerId).toBeTruthy()

      const delivered = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
        destinationAddress: maskedId,
        requestId: providerId!,
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
        requestId: providerId!,
        deliveryStatus: 'FAILED',
        timeStamp: stamp(),
      })
      expect(failed).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

      const afterFailed = await e2eDb().smsBroadcast.findUniqueOrThrow({ where: { id: broadcast.id } })
      expect(afterFailed.failedCount).toBe(1)
      expect(afterFailed.targetCount).toBe(2)
      expect(afterFailed.deliveredCount).toBe(1)
    } finally {
      await admin.context.close()
    }
  })
})
