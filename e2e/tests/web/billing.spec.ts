import type { APIRequestContext } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createEmailTrialUser, unusedPhone, toDbPhone } from '../../support/users'
import { createProfileWithLogs, setUserSubscription } from '../../support/db'
import { SECRETS, URLS } from '../../support/slot'
import type { FakeBdappsClient } from '../../support/fake-bdapps'
import { translogFor } from '../../support/translog'

/** Run the daily-reminders cron for one user (forced), failing on any per-user error. */
async function runDailyReminders(userId: string): Promise<void> {
  const res = await fetch(`${URLS.web}/api/cron/daily-reminders`, {
    method: 'POST',
    headers: { authorization: `Bearer ${SECRETS.cronSecret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ userId, force: true }),
  })
  expect(res.ok).toBe(true)
  expect(((await res.json()) as { errors: number }).errors).toBe(0)
}

/** Count of SMS the app sent through the fake BDApps to this local-format phone. */
async function smsSentTo(fakeBdapps: FakeBdappsClient, phone: string): Promise<number> {
  return (await fakeBdapps.calls({ path: '/sms/send' })).filter((c) => JSON.stringify(c.body).includes(phone.slice(1))).length
}

test.describe('Web billing: upgrade and unsubscribe', () => {
  test('flow: a Free user upgrades to Pro through the fake BDApps, and Pro features unlock', async ({ browser, fakeBdapps, db, days }) => {
    const { context, email } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()

    try {
      await page.goto('/subscription')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Go Pro')
      await expect(page.getByText('Cycle Circle Free', { exact: true })).toBeVisible()

      // Upgrade card is visible
      const upgradeCard = page.getByRole('button', { name: 'Upgrade to Pro' })
      await expect(upgradeCard).toBeVisible()
      await upgradeCard.click()

      // AddPhoneDialog opens in upgrade mode
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Upgrade to Pro')

      const phone = await unusedPhone()
      await dialog.getByLabel('Mobile number').fill(phone)
      await dialog.getByRole('button', { name: 'Send code' }).click()

      // Wait for code step and OTP from fake BDApps
      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Enter the code')
      const otp = await fakeBdapps.latestOtp(phone)
      expect(otp.kind).toBe('bdapps')

      expect(await fakeBdapps.subscriber(phone)).toBeUndefined()
      const since = (await fakeBdapps.calls()).at(-1)?.seq ?? 0
      await dialog.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)

      // Success feedback appears and dialog closes
      await expect(dialog.getByRole('heading', { name: "Your number is verified — you're now on Pro!" })).toBeVisible()
      await expect(dialog).not.toBeVisible({ timeout: 10_000 })

      // The fake proves the upgrade: the app verified this OTP and BDApps now holds the number as
      // REGISTERED (ADR 0002: the subscribe happens in otp/verify).
      const verifies = await fakeBdapps.calls({ path: '/subscription/otp/verify', sinceSeq: since })
      expect(verifies.some((c) => c.body.otp === otp.code && c.response.statusCode === 'S1000')).toBe(true)
      expect(await fakeBdapps.subscriber(phone)).toMatchObject({ status: 'REGISTERED' })

      // Page UI immediately updates to Pro
      await expect(page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible()
      await expect(page.getByText('Cycle Circle Free', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Unsubscribe from Pro' })).toBeVisible()

      // Survives a reload
      await page.reload()
      await expect(page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Unsubscribe from Pro' })).toBeVisible()

      // In settings, plan shows PRO and no upgrade badge
      await page.goto('/settings')
      await expect(page.getByText('Pro', { exact: true })).toBeVisible()
      await expect(page.locator('main').getByRole('link', { name: 'Subscription' })).toBeVisible()
      await expect(page.locator('main').getByRole('link', { name: 'Subscription' })).not.toContainText('Upgrade')

      // API confirms subscriptionStatus PRO
      const statusRes = await page.request.get('/api/auth/status')
      const { user } = await statusRes.json()
      expect(user).toMatchObject({ subscriptionStatus: 'PRO', email })

      // A real Pro behaviour, not just chrome: the reminder cron now sends this user an SMS
      const dbUser = await db.user.findUniqueOrThrow({ where: { email } })
      await createProfileWithLogs({ userId: dbUser.id, days })
      expect(await smsSentTo(fakeBdapps, phone)).toBe(0)
      await runDailyReminders(dbUser.id)
      expect(await smsSentTo(fakeBdapps, phone)).toBeGreaterThanOrEqual(1)
    } finally {
      await context.close()
    }
  })

  test('flow: a Pro user unsubscribes; the fake BDApps records the unsubscribe and the user is Free after a reload', async ({ newUser, fakeBdapps }) => {
    const { phone, page } = await newUser()
    await page.goto('/subscription')
    await expect(page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible()

    const subscriber = await fakeBdapps.subscriber(phone)
    expect(subscriber).toMatchObject({ status: 'REGISTERED' })

    const since = (await fakeBdapps.calls()).at(-1)?.seq ?? 0

    // Click Unsubscribe
    await page.getByRole('button', { name: 'Unsubscribe from Pro' }).click()

    // Confirmation modal
    const confirmModal = page.getByRole('dialog', { name: 'Unsubscribe from Pro?' })
    await expect(confirmModal).toBeVisible()
    await confirmModal.getByRole('button', { name: 'Unsubscribe' }).click()
    await expect(confirmModal).not.toBeVisible()

    // Live region confirms cancellation
    await expect(page.getByText("You're unsubscribed. You're now on the free plan.")).toBeVisible()

    // Fake BDApps recorded the merchant call to /subscription/send with action 0
    const calls = await fakeBdapps.calls({ path: '/subscription/send', sinceSeq: since })
    expect(calls.some((c) => c.body.subscriberId === subscriber!.maskedId && c.body.action === '0')).toBe(true)

    // Subscriber status is now UNREGISTERED on BDApps
    expect(await fakeBdapps.subscriber(phone)).toMatchObject({ status: 'UNREGISTERED' })

    // Reload: user is now Free
    await page.reload()
    await expect(page.getByText('Cycle Circle Free', { exact: true })).toBeVisible()
    await expect(page.getByText('Cycle Circle Pro', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Upgrade to Pro' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unsubscribe from Pro' })).toHaveCount(0)

    // Settings confirms Free plan and upgrade badge
    await page.goto('/settings')
    await expect(page.getByText('Free', { exact: true })).toBeVisible()
    await expect(page.locator('main').getByRole('link', { name: 'Subscription Upgrade' })).toBeVisible()

    // API confirms FREE
    const statusRes = await page.request.get('/api/auth/status')
    const { user } = await statusRes.json()
    expect(user).toMatchObject({ subscriptionStatus: 'FREE' })
  })

  test('a BDApps failure during subscribe shows a clear error and leaves the plan unchanged', async ({ browser, fakeBdapps }) => {
    const { context } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()

    try {
      await page.goto('/subscription')
      await expect(page.getByText('Cycle Circle Free', { exact: true })).toBeVisible()

      // Script a failure on /subscription/otp/request scoped to this phone
      const phone = await unusedPhone()
      await fakeBdapps.failNext('/subscription/otp/request', {
        match: { phone },
        mode: 'error',
        statusCode: 'E1601',
      })

      await page.getByRole('button', { name: 'Upgrade to Pro' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Upgrade to Pro')

      await dialog.getByLabel('Mobile number').fill(phone)
      await dialog.getByRole('button', { name: 'Send code' }).click()

      // Error message is displayed in dialog
      await expect(dialog.getByRole('alert')).toHaveText('Something went wrong. Please try again.')

      // Close dialog by pressing Escape
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()

      // Plan remains Free
      await page.reload()
      await expect(page.getByText('Cycle Circle Free', { exact: true })).toBeVisible()
      const statusRes = await page.request.get('/api/auth/status')
      const { user } = await statusRes.json()
      expect(user.subscriptionStatus).toBe('FREE')
    } finally {
      await context.close()
    }
  })

  test('an email-trial user whose 24-hour trial has ended sees the trial lock; only upgrading or logging out gets past it', async ({
    browser,
    days,
    db,
    fakeBdapps,
  }) => {
    const { context, email } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()

    try {
      // Age the trial to expired in the slot DB using the server-time Bangladesh-day helper (no fake clock)
      const user = await db.user.findUniqueOrThrow({ where: { email } })
      await db.user.update({
        where: { id: user.id },
        data: { emailTrialExpiresAt: days.startOf(days.daysAgo(1)) },
      })

      await page.goto('/dashboard')

      // Trial lock modal is visible and covers the page
      const lockModal = page.getByRole('dialog', { name: /trial has ended/i })
      await expect(lockModal).toBeVisible({ timeout: 15_000 })
      await expect(lockModal.getByRole('heading', { level: 2 })).toHaveText('Your 24-hour trial has ended')
      await expect(
        lockModal.getByText('Upgrade to Pro to keep tracking your cycle and unlock all features.'),
      ).toBeVisible()

      // Lock is non-dismissible: ESC and clicking backdrop do nothing, and no close button exists
      await page.keyboard.press('Escape')
      await expect(lockModal).toBeVisible()
      expect(await lockModal.getByRole('button', { name: /close/i }).count()).toBe(0)

      // The lock follows the user across every signed-in page and cannot be dismissed
      for (const route of ['/calendar', '/insights', '/settings', '/symptoms', '/content']) {
        await page.goto(route)
        await expect(lockModal).toBeVisible({ timeout: 15_000 })
        await page.keyboard.press('Escape')
        await expect(lockModal).toBeVisible()
      }
      await page.goto('/dashboard')
      await expect(lockModal).toBeVisible({ timeout: 15_000 })

      // Protected API routes return 402 TRIAL_EXPIRED while trial is expired
      const apiRes = await page.request.get('/api/profiles')
      expect(apiRes.status()).toBe(402)
      expect((await apiRes.json()).error.code).toBe('TRIAL_EXPIRED')

      // Clicking Upgrade to Pro navigates to /subscription where the lock is not shown
      await lockModal.getByRole('link', { name: 'Upgrade to Pro' }).click()
      await expect(page).toHaveURL(/\/subscription/)
      await expect(lockModal).not.toBeVisible()

      // Upgrade to Pro via BDApps OTP
      await page.getByRole('button', { name: 'Upgrade to Pro' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()

      const phone = await unusedPhone()
      await dialog.getByLabel('Mobile number').fill(phone)
      await dialog.getByRole('button', { name: 'Send code' }).click()

      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Enter the code')
      const otp = await fakeBdapps.latestOtp(phone)
      await dialog.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)

      await expect(dialog.getByRole('heading', { name: "Your number is verified — you're now on Pro!" })).toBeVisible()
      await expect(dialog).not.toBeVisible({ timeout: 10_000 })

      // User is now Pro
      await expect(page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible()

      // Navigating back to /dashboard is now completely unlocked!
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard/)
      await expect(lockModal).not.toBeVisible()

      // API route is unlocked (200 OK)
      const postUpgradeApi = await page.request.get('/api/profiles')
      expect(postUpgradeApi.status()).toBe(200)
    } finally {
      await context.close()
    }
  })

  test('trial lock logout option clears session and redirects to login', async ({ browser, days, db }) => {
    const { context, email } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()

    try {
      const user = await db.user.findUniqueOrThrow({ where: { email } })
      await db.user.update({
        where: { id: user.id },
        data: { emailTrialExpiresAt: days.startOf(days.daysAgo(1)) },
      })

      await page.goto('/dashboard')
      const lockModal = page.getByRole('dialog', { name: /trial has ended/i })
      await expect(lockModal).toBeVisible({ timeout: 15_000 })

      // Click "Log out"
      await lockModal.getByRole('button', { name: 'Log out' }).click()
      await expect(page).toHaveURL(/\/login/)

      // Session is ended: accessing protected dashboard redirects back to login
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/)
    } finally {
      await context.close()
    }
  })

  test('flow: an email-trial user adds and verifies a phone number through the fake BDApps in Settings', async ({
    browser,
    fakeBdapps,
  }) => {
    const { context, email } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()

    try {
      await page.goto('/settings')
      await expect(page.getByText('Free', { exact: true })).toBeVisible()

      // Click Add Phone Number button
      await page.getByRole('button', { name: 'Add Phone Number' }).click()

      // Dialog opens in keep-account mode
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Keep your account')

      const phone = await unusedPhone()
      await dialog.getByLabel('Mobile number').fill(phone)
      await dialog.getByRole('button', { name: 'Send code' }).click()

      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Enter the code')
      const otp = await fakeBdapps.latestOtp(phone)
      expect(otp.kind).toBe('bdapps')

      await dialog.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)

      await expect(dialog.getByRole('heading', { name: "Your number is verified — you're now on Pro!" })).toBeVisible()
      await expect(dialog).not.toBeVisible({ timeout: 10_000 })

      // Settings now displays the added phone and Pro status
      const expectedDbPhone = `+880${phone.slice(1)}`
      await expect(page.getByText(expectedDbPhone)).toBeVisible()
      await expect(page.getByText('Pro', { exact: true })).toBeVisible()
      await expect(page.locator('main').getByRole('link', { name: 'Subscription' })).not.toContainText('Upgrade')

      // Reload verifies persistence
      await page.reload()
      await expect(page.getByText(expectedDbPhone)).toBeVisible()
      await expect(page.getByText('Pro', { exact: true })).toBeVisible()

      // API confirms phone is saved, subscription is PRO, and email trial is cleared
      const statusRes = await page.request.get('/api/auth/status')
      const { user } = await statusRes.json()
      expect(user).toMatchObject({
        email,
        phone: expectedDbPhone,
        subscriptionStatus: 'PRO',
        emailTrialExpiresAt: null,
      })
    } finally {
      await context.close()
    }
  })

})

/**
 * Pro-only features (subscription page "Free vs Pro" table; DEV_SRS FR-BILL / FR-SMS; TESTING.md FR-GATE):
 * SMS Alerts, Data Export, Advanced Predictions, Ad-free Experience.
 * Only SMS alerts are gated in v1; Data Export and Advanced Predictions gating is deferred (FR-GATE) and
 * asserted as ungated. Ad-free has nothing to gate: the app renders no ads at all.
 */
test.describe('Web billing: Pro-only features are gated for a Free user', () => {
  test('the Free vs Pro table lists exactly which features are Pro-only', async ({ browser }) => {
    const { context } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()
    try {
      await page.goto('/subscription')
      await expect(page.getByText('Cycle Circle Free', { exact: true })).toBeVisible()
      const table = page.getByRole('table', { name: 'Free vs Pro' })
      await expect(table).toBeVisible()
      const expectRow = async (feature: string, free: string, pro: string) => {
        const cells = table.getByRole('row', { name: new RegExp(`^${feature}`) }).getByRole('cell')
        await expect(cells.nth(0)).toHaveText(free)
        await expect(cells.nth(1)).toHaveText(pro)
      }
      for (const feat of ['Cycle Tracking', 'Calendar View', 'Symptom Logging', 'Health Articles']) {
        await expectRow(feat, 'Included', 'Included')
      }
      for (const feat of ['SMS Alerts', 'Data Export', 'Advanced Predictions', 'Ad-free Experience']) {
        await expectRow(feat, 'Not included', 'Included')
      }
      await expect(page.getByRole('button', { name: 'Unsubscribe from Pro' })).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  test('SMS alerts: the daily-reminders cron sends an SMS to a Pro user but not to the same user once Free', async ({
    newUser,
    days,
    db,
    fakeBdapps,
  }) => {
    const { phone } = await newUser()
    const user = await db.user.findFirstOrThrow({ where: { phone: toDbPhone(phone) } })
    await createProfileWithLogs({ userId: user.id, days })

    const runCron = async () => {
      const res = await fetch(`${URLS.web}/api/cron/daily-reminders`, {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRETS.cronSecret}`, 'content-type': 'application/json' },
        body: JSON.stringify({ userId: user.id, force: true }),
      })
      expect(res.ok).toBe(true)
      expect(((await res.json()) as { errors: number }).errors).toBe(0)
    }
    const smsToUser = async () =>
      (await fakeBdapps.calls({ path: '/sms/send' })).filter((c) => JSON.stringify(c.body).includes(phone.slice(1))).length

    // Free: the reminder email still goes out, the SMS does not
    await setUserSubscription({ userId: user.id, status: 'FREE' })
    await runCron()
    expect(await smsToUser()).toBe(0)

    // Pro again: the same cron run now sends the SMS
    await setUserSubscription({ userId: user.id, status: 'PRO' })
    await runCron()
    expect(await smsToUser()).toBeGreaterThanOrEqual(1)
  })

  // Data Export and Advanced Predictions are sold as Pro on the page, but their route gating is a
  // documented post-v1 deferral (DEV_SRS FR-GATE; TESTING.md "Not testable (v1)"). These tests pin the
  // CURRENT behaviour (ungated) so a change to it is noticed; flip them when FR-GATE ships.
  test('data export: gating is deferred (FR-GATE), so a Free user can still download their data', async ({ browser }) => {
    const { context } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()
    try {
      await page.goto('/settings')
      const csv = page.getByRole('button', { name: /csv/i })
      await expect(csv).toBeVisible()
      const download = page.waitForEvent('download', { timeout: 10_000 })
      await csv.click()
      expect((await download).suggestedFilename()).toMatch(/\.csv$/i)
    } finally {
      await context.close()
    }
  })

  test('advanced predictions: gating is deferred (FR-GATE), so a Free user with 7 cycles gets the same ARIMA tier as Pro', async ({
    browser,
    newUser,
    days,
    db,
  }) => {
    // Log 7 cycles through the real API (oldest first) so the app computes the prediction itself
    const seedCycles = async (request: APIRequestContext, profileId: string) => {
      for (let i = 6; i >= 0; i--) {
        const res = await request.post('/api/tracking/period-logs', {
          data: { profileId, startDate: days.daysAgo(10 + 28 * i), endDate: days.daysAgo(6 + 28 * i), flowIntensity: 'MEDIUM' },
        })
        expect(res.status()).toBe(201)
      }
    }
    const tierFor = async (request: APIRequestContext, profileId: string) => {
      const res = await request.get(`/api/predictions?profileId=${profileId}`)
      expect(res.status()).toBe(200)
      return (await res.json()).prediction.tier as string
    }

    const pro = await newUser()
    const proUser = await db.user.findFirstOrThrow({ where: { phone: toDbPhone(pro.phone) } })
    const proProfile = await db.profile.create({
      data: { userId: proUser.id, name: 'Pro', relation: 'SELF', cycleLength: 28, periodLength: 5 },
    })
    await seedCycles(pro.page.request, proProfile.id)
    expect(await tierFor(pro.page.request, proProfile.id)).toBe('ARIMA')

    const { context, email } = await createEmailTrialUser(browser, {}, { withProfile: true })
    try {
      const freeUser = await db.user.findUniqueOrThrow({ where: { email }, include: { profiles: true } })
      const profileId = freeUser.profiles[0]!.id
      await seedCycles(context.request, profileId)
      expect(await tierFor(context.request, profileId)).toBe('ARIMA')
    } finally {
      await context.close()
    }
  })
})

test.describe('Web billing: BDApps subscription-notify (REGISTERED)', () => {
  test('moves a Free subscriber to Pro, shows Pro after a reload, and the translog records the cause', async ({ newUser, fakeBdapps, db }) => {
    const { phone, page } = await newUser()
    const user = await db.user.findFirstOrThrow({ where: { phone: toDbPhone(phone) } })
    await setUserSubscription({ userId: user.id, status: 'FREE' })
    await page.goto('/subscription')
    await expect(page.getByText('Cycle Circle Free', { exact: true })).toBeVisible()

    // BDApps tells the app the number is registered (e.g. subscribed by USSD)
    const subscriber = await fakeBdapps.subscriber(phone)
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
    const sent = await fakeBdapps.sendWebhook('/api/webhooks/subscription/notify', {
      applicationId: SECRETS.bdappsAppId,
      subscriberId: subscriber!.maskedId,
      status: 'REGISTERED',
      timeStamp: stamp,
    })
    expect(sent).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

    await page.reload()
    await expect(page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible()
    await expect(page.getByText('Cycle Circle Free', { exact: true })).toHaveCount(0)

    await expect
      .poll(() => translogFor(user.id).find((l) => l.event === 'plan.change' && l.data.cause === 'webhook'))
      .toMatchObject({ data: { from: 'FREE', to: 'PRO', cause: 'webhook', changed: true } })
  })
})
