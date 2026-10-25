/**
 * Admin user actions (#127): suspend/reactivate, delete/restore, grant/revoke Pro.
 * Spec story 22 / W09 (suspended or deleted web session blocked) is covered here too.
 */
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'
import { loginWithOtp, toDbPhone } from '../../support/users'
import { translogFor } from '../../support/translog'
import type { Browser, BrowserContextOptions, Page } from '@playwright/test'
import type { FakeBdappsClient } from '../../support/fake-bdapps'

type AdminViewport = Pick<
  BrowserContextOptions,
  'viewport' | 'userAgent' | 'isMobile' | 'hasTouch' | 'deviceScaleFactor' | 'locale' | 'timezoneId'
>

async function openAdminForUser(
  browser: Browser,
  userId: string,
  marker: string,
  viewport: AdminViewport,
) {
  const admin = await createLoggedInAdmin(browser, viewport)
  const { page } = admin
  await page.goto(`/users/${userId}`)
  await expect(page.getByRole('heading', { name: marker, exact: true })).toBeVisible({
    timeout: 15_000,
  })
  return admin
}

async function confirmDialog(page: Page, confirmName: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: confirmName, exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

/** Wait until fake BDApps shows this phone as UNREGISTERED and records an unsubscribe send. */
async function expectBdappsUnsubscribed(
  fakeBdapps: FakeBdappsClient,
  phone: string,
  maskedId: string,
  sinceSeq: number,
) {
  await expect
    .poll(async () => (await fakeBdapps.subscriber(phone))?.status, { timeout: 15_000 })
    .toBe('UNREGISTERED')
  await expect
    .poll(async () => {
      const calls = await fakeBdapps.calls({ path: '/subscription/send', sinceSeq })
      return calls.some(
        (c) =>
          String(c.body?.subscriberId ?? '') === maskedId && String(c.body?.action ?? '') === '0',
      )
    })
    .toBe(true)
}

test.describe('Admin user actions', () => {
  test('suspend blocks the web session and unsubscribes BDApps; reactivate allows login again', async ({
    browser,
    newUser,
    fakeBdapps,
    db,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const viewportOpts = { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId }
    const user = await newUser()
    const stored = toDbPhone(user.phone)
    const marker = `E2E Sus ${user.phone.slice(-6)}`
    await e2eDb().user.update({ where: { phone: stored }, data: { fullName: marker } })
    const row = await e2eDb().user.findUniqueOrThrow({ where: { phone: stored } })

    // Existing session works before suspend (W09 baseline).
    const beforeStatus = await user.page.request.get('/api/auth/status')
    expect(beforeStatus.ok()).toBe(true)

    const subscriber = await fakeBdapps.subscriber(user.phone)
    expect(subscriber).toMatchObject({ status: 'REGISTERED' })
    const maskedId = subscriber!.maskedId
    const callsBefore = await fakeBdapps.calls({ path: '/subscription/send' })
    const sinceSeq = callsBefore.length > 0 ? callsBefore[callsBefore.length - 1].seq : 0

    const admin = await openAdminForUser(browser, row.id, marker, viewportOpts)
    try {
      await admin.page.getByRole('button', { name: 'Suspend', exact: true }).click()
      await admin.page.getByLabel(/Reason \(required/).fill('E2E suspend — abuse report')
      await confirmDialog(admin.page, 'Suspend')

      await expect(admin.page.getByText('Suspended', { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      })
      await expect(admin.page.getByRole('button', { name: 'Reactivate', exact: true })).toBeVisible()

      await expectBdappsUnsubscribed(fakeBdapps, user.phone, maskedId, sinceSeq)

      // W09: existing web session is blocked (sessionsValidAfter → verifyAuth null → 401).
      await expect
        .poll(async () => (await user.page.request.get('/api/auth/status')).status())
        .toBe(401)
      await user.page.goto('/dashboard')
      await expect(user.page).toHaveURL(/\/login/)

      await admin.page.getByRole('button', { name: 'Reactivate', exact: true }).click()
      await confirmDialog(admin.page, 'Reactivate')
      await expect(admin.page.getByRole('button', { name: 'Suspend', exact: true })).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await admin.context.close()
    }

    // After reactivate, a fresh OTP login works (BDApps was unsubscribed → BDApps OTP path).
    await db.otpChallenge.updateMany({
      where: { phone: stored },
      data: { createdAt: new Date(Date.now() - 70_000) },
    })
    await loginWithOtp(user.context.request, user.phone, fakeBdapps)
    const after = await user.context.request.get('/api/auth/status')
    expect(after.ok()).toBe(true)
    expect((await after.json()).user).toMatchObject({ id: row.id })
  })

  test('delete and restore within 30 days; deleted session is blocked', async ({
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
    const viewportOpts = { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId }
    const user = await newUser()
    const stored = toDbPhone(user.phone)
    const marker = `E2E Del ${user.phone.slice(-6)}`
    await e2eDb().user.update({ where: { phone: stored }, data: { fullName: marker } })
    const row = await e2eDb().user.findUniqueOrThrow({ where: { phone: stored } })

    const subscriber = await fakeBdapps.subscriber(user.phone)
    const maskedId = subscriber!.maskedId
    const callsBefore = await fakeBdapps.calls({ path: '/subscription/send' })
    const sinceSeq = callsBefore.length > 0 ? callsBefore[callsBefore.length - 1].seq : 0

    const admin = await openAdminForUser(browser, row.id, marker, viewportOpts)
    try {
      await admin.page.getByRole('button', { name: 'Delete', exact: true }).click()
      await confirmDialog(admin.page, 'Delete')

      await expect(admin.page.getByText(/Deleted /)).toBeVisible({ timeout: 15_000 })
      await expect(admin.page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible()

      await expectBdappsUnsubscribed(fakeBdapps, user.phone, maskedId, sinceSeq)

      // W09 (deleted): existing session blocked.
      await expect
        .poll(async () => (await user.page.request.get('/api/auth/status')).status())
        .toBe(401)

      await admin.page.getByRole('button', { name: 'Restore', exact: true }).click()
      await confirmDialog(admin.page, 'Restore')
      await expect(admin.page.getByRole('button', { name: 'Suspend', exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await expect(admin.page.getByText('Active', { exact: true }).first()).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('a user deleted more than 30 days ago cannot be restored', async ({
    browser,
    newUser,
    days,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const viewportOpts = { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId }
    const user = await newUser()
    const stored = toDbPhone(user.phone)
    const marker = `E2E OldDel ${user.phone.slice(-6)}`
    // Soft-delete aged past the restore window (UI can't reach this clock state in time).
    await e2eDb().user.update({
      where: { phone: stored },
      data: {
        fullName: marker,
        deletedAt: days.startOf(days.daysAgo(31)),
      },
    })
    const row = await e2eDb().user.findUniqueOrThrow({ where: { phone: stored } })

    const admin = await openAdminForUser(browser, row.id, marker, viewportOpts)
    try {
      await expect(admin.page.getByText(/Restore window \(30 days\) has passed/)).toBeVisible()
      await expect(admin.page.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(0)
    } finally {
      await admin.context.close()
    }
  })

  test('grant and revoke Pro: plan history, admin translog, and web plan update', async ({
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
    const viewportOpts = { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId }
    const user = await newUser()
    const stored = toDbPhone(user.phone)
    const marker = `E2E Plan ${user.phone.slice(-6)}`
    await e2eDb().user.update({ where: { phone: stored }, data: { fullName: marker } })
    const row = await e2eDb().user.findUniqueOrThrow({ where: { phone: stored } })

    await user.page.goto('/subscription')
    await expect(user.page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible()

    const subscriber = await fakeBdapps.subscriber(user.phone)
    const maskedId = subscriber!.maskedId
    const callsBefore = await fakeBdapps.calls({ path: '/subscription/send' })
    const sinceSeq = callsBefore.length > 0 ? callsBefore[callsBefore.length - 1].seq : 0

    const admin = await openAdminForUser(browser, row.id, marker, viewportOpts)
    try {
      // A04: Profiles tab (throwaway has none yet).
      await expect(admin.page.getByRole('tab', { name: 'Profiles' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      await expect(admin.page.getByText('No profiles created yet.')).toBeVisible()

      // Revoke Pro → Free (Select + confirm).
      await admin.page.getByRole('combobox', { name: 'Set subscription status' }).click()
      await admin.page.getByRole('option', { name: 'Free', exact: true }).click()
      await confirmDialog(admin.page, 'Set FREE')

      await expect(admin.page.getByRole('combobox', { name: 'Set subscription status' })).toContainText(
        'Free',
        { timeout: 15_000 },
      )
      await expectBdappsUnsubscribed(fakeBdapps, user.phone, maskedId, sinceSeq)

      await expect
        .poll(() =>
          translogFor(row.id, { app: 'admin' }).find(
            (l) => l.event === 'plan.change' && l.data.cause === 'admin' && l.data.to === 'FREE',
          ),
        )
        .toMatchObject({ data: { from: 'PRO', to: 'FREE', cause: 'admin', changed: true } })

      // Plan history is loaded only when ?tab=plan is on the RSC request (page.tsx).
      // Cause label "Admin" shares a <p> with "· by admin <id>", so match FREE badge + Admin substring.
      await admin.page.goto(`/users/${row.id}?tab=plan`)
      await expect(admin.page.getByRole('heading', { name: marker, exact: true })).toBeVisible()
      await expect(admin.page.getByRole('tab', { name: 'Plan history' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      const planPanel = admin.page.getByRole('tabpanel')
      await expect(planPanel.getByText('FREE', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
      await expect(planPanel.getByText(/Admin/).first()).toBeVisible()

      await user.page.reload()
      await expect(user.page.getByText('Cycle Circle Free', { exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await expect(user.page.getByText('Cycle Circle Pro', { exact: true })).toHaveCount(0)

      // Grant Pro again.
      await admin.page.getByRole('combobox', { name: 'Set subscription status' }).click()
      await admin.page.getByRole('option', { name: 'Pro', exact: true }).click()
      await confirmDialog(admin.page, 'Set PRO')
      await expect(admin.page.getByRole('combobox', { name: 'Set subscription status' })).toContainText(
        'Pro',
        { timeout: 15_000 },
      )

      await expect
        .poll(() =>
          translogFor(row.id, { app: 'admin' }).find(
            (l) => l.event === 'plan.change' && l.data.cause === 'admin' && l.data.to === 'PRO',
          ),
        )
        .toMatchObject({ data: { from: 'FREE', to: 'PRO', cause: 'admin', changed: true } })

      await admin.page.goto(`/users/${row.id}?tab=plan`)
      await expect(admin.page.getByRole('heading', { name: marker, exact: true })).toBeVisible()
      await expect(admin.page.getByRole('tabpanel').getByText('PRO', { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      })

      await user.page.reload()
      await expect(user.page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await admin.context.close()
    }
  })
})
