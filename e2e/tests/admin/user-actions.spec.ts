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

/** Status badge next to the user heading (not list filters / other copy). */
function headerStatus(page: Page, marker: string, status: 'Active' | 'Suspended') {
  // eslint-disable-next-line playwright/no-raw-locators -- status badge is an unnamed sibling of the heading
  return page
    .getByRole('heading', { name: marker, exact: true })
    .locator('xpath=..')
    .getByText(status, { exact: true })
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

/** Open Plan history via the tab (RSC loads entries when ?tab=plan). Fallback: direct goto. */
async function openPlanHistory(page: Page, userId: string, marker: string) {
  await page.getByRole('tab', { name: 'Plan history' }).click()
  await expect(page).toHaveURL(/[?&]tab=plan/)
  await expect(page.getByRole('tab', { name: 'Plan history' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const panel = page.getByRole('tabpanel')
  try {
    await expect(panel.getByRole('listitem').first()).toBeVisible({ timeout: 8_000 })
  } catch {
    // Soft nav sometimes keeps the prior RSC payload (planHistory null) — hard reload.
    await page.goto(`/users/${userId}?tab=plan`)
    await expect(page.getByRole('heading', { name: marker, exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Plan history' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('tabpanel').getByRole('listitem').first()).toBeVisible({
      timeout: 15_000,
    })
  }
  return page.getByRole('tabpanel')
}

/** Login through the web /login UI (context already has per-test x-real-ip). */
async function loginViaUi(page: Page, phone: string, fakeBdapps: FakeBdappsClient) {
  await page.goto('/login')
  await page.getByLabel('Phone Number').fill(phone)
  const since = new Date()
  await page.getByRole('button', { name: 'Send OTP' }).click()
  await expect(page).toHaveURL(/\/verify-otp/)
  const otp = await fakeBdapps.latestOtp(phone, { since })
  await page.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)
  await expect(page).not.toHaveURL(/\/(login|verify-otp)/, { timeout: 15_000 })
  return otp
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

      await expect(headerStatus(admin.page, marker, 'Suspended')).toBeVisible({ timeout: 15_000 })
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
      await expect(headerStatus(admin.page, marker, 'Active')).toBeVisible()

      // Reactivate lifts our block only — deliberately does not re-subscribe (ADR 0006).
      await expect
        .poll(async () => (await fakeBdapps.subscriber(user.phone))?.status)
        .toBe('UNREGISTERED')
    } finally {
      await admin.context.close()
    }

    // After reactivate, login via the real /login UI (BDApps OTP — number is UNREGISTERED).
    await db.otpChallenge.updateMany({
      where: { phone: stored },
      data: { createdAt: new Date(Date.now() - 70_000) },
    })
    const otp = await loginViaUi(user.page, user.phone, fakeBdapps)
    expect(otp.kind).toBe('bdapps')
    const after = await user.page.request.get('/api/auth/status')
    expect(after.ok()).toBe(true)
    expect((await after.json()).user).toMatchObject({ id: row.id })
  })

  test('delete and restore within 30 days; deleted session is blocked', async ({
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
    const marker = `E2E Del ${user.phone.slice(-6)}`
    await e2eDb().user.update({ where: { phone: stored }, data: { fullName: marker } })
    const row = await e2eDb().user.findUniqueOrThrow({ where: { phone: stored } })

    // W09 baseline: session is valid before delete.
    const beforeStatus = await user.page.request.get('/api/auth/status')
    expect(beforeStatus.ok()).toBe(true)

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

      // W09 (deleted): existing session blocked — API + open page.
      await expect
        .poll(async () => (await user.page.request.get('/api/auth/status')).status())
        .toBe(401)
      await user.page.goto('/dashboard')
      await expect(user.page).toHaveURL(/\/login/)

      await admin.page.getByRole('button', { name: 'Restore', exact: true }).click()
      await confirmDialog(admin.page, 'Restore')
      await expect(admin.page.getByRole('button', { name: 'Suspend', exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await expect(headerStatus(admin.page, marker, 'Active')).toBeVisible()
    } finally {
      await admin.context.close()
    }

    const restored = await e2eDb().user.findUniqueOrThrow({ where: { id: row.id } })
    expect(restored.deletedAt).toBeNull()

    // Restore clears deletedAt only — does not re-subscribe (ADR 0006).
    await expect
      .poll(async () => (await fakeBdapps.subscriber(user.phone))?.status)
      .toBe('UNREGISTERED')

    await db.otpChallenge.updateMany({
      where: { phone: stored },
      data: { createdAt: new Date(Date.now() - 70_000) },
    })
    await loginWithOtp(user.context.request, user.phone, fakeBdapps)
    const after = await user.context.request.get('/api/auth/status')
    expect(after.ok()).toBe(true)
    expect((await after.json()).user).toMatchObject({ id: row.id })
  })

  test('restore window: 29 days still works; 31 days does not', async ({
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

    // 29 days ago: still inside the inclusive 30-day window.
    const within = await newUser()
    const withinStored = toDbPhone(within.phone)
    const withinMarker = `E2E Del29 ${within.phone.slice(-6)}`
    await e2eDb().user.update({
      where: { phone: withinStored },
      data: {
        fullName: withinMarker,
        deletedAt: days.startOf(days.daysAgo(29)),
      },
    })
    const withinRow = await e2eDb().user.findUniqueOrThrow({ where: { phone: withinStored } })

    const adminWithin = await openAdminForUser(browser, withinRow.id, withinMarker, viewportOpts)
    try {
      await expect(adminWithin.page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible()
      await adminWithin.page.getByRole('button', { name: 'Restore', exact: true }).click()
      await confirmDialog(adminWithin.page, 'Restore')
      await expect(adminWithin.page.getByRole('button', { name: 'Suspend', exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await expect(headerStatus(adminWithin.page, withinMarker, 'Active')).toBeVisible()
    } finally {
      await adminWithin.context.close()
    }
    expect(
      (await e2eDb().user.findUniqueOrThrow({ where: { id: withinRow.id } })).deletedAt,
    ).toBeNull()

    // 31 days ago: restore window expired.
    const expired = await newUser()
    const expiredStored = toDbPhone(expired.phone)
    const expiredMarker = `E2E OldDel ${expired.phone.slice(-6)}`
    await e2eDb().user.update({
      where: { phone: expiredStored },
      data: {
        fullName: expiredMarker,
        deletedAt: days.startOf(days.daysAgo(31)),
      },
    })
    const expiredRow = await e2eDb().user.findUniqueOrThrow({ where: { phone: expiredStored } })

    const adminExpired = await openAdminForUser(browser, expiredRow.id, expiredMarker, viewportOpts)
    try {
      await expect(adminExpired.page.getByText(/Restore window \(30 days\) has passed/)).toBeVisible()
      await expect(adminExpired.page.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(0)
    } finally {
      await adminExpired.context.close()
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
        { timeout: 30_000 },
      )
      await expectBdappsUnsubscribed(fakeBdapps, user.phone, maskedId, sinceSeq)

      await expect
        .poll(() =>
          translogFor(row.id, { app: 'admin' }).find(
            (l) => l.event === 'plan.change' && l.data.cause === 'admin' && l.data.to === 'FREE',
          ),
        )
        .toMatchObject({ data: { from: 'PRO', to: 'FREE', cause: 'admin', changed: true } })

      const planPanel = await openPlanHistory(admin.page, row.id, marker)
      const rowsBeforeGrant = await planPanel.getByRole('listitem').count()
      // textContent includes the aria-hidden arrow (PRO→toFREE); cause line has "Admin".
      const revokeRow = planPanel
        .getByRole('listitem')
        .filter({ hasText: /PRO.*FREE/ })
        .filter({ hasText: /Admin/ })
      await expect(revokeRow).toBeVisible({ timeout: 15_000 })

      await user.page.reload()
      await expect(user.page.getByText('Cycle Circle Free', { exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await expect(user.page.getByText('Cycle Circle Pro', { exact: true })).toHaveCount(0)

      // Grant Pro again — leaves BDApps alone (ADR 0006); subscriber stays UNREGISTERED.
      await admin.page.getByRole('combobox', { name: 'Set subscription status' }).click()
      await admin.page.getByRole('option', { name: 'Pro', exact: true }).click()
      await confirmDialog(admin.page, 'Set PRO')
      // The select stays disabled while router.refresh() re-renders the heavy detail page; under a
      // full parallel run that took over 15 s once (local, 4 workers).
      await expect(admin.page.getByRole('combobox', { name: 'Set subscription status' })).toContainText(
        'Pro',
        { timeout: 30_000 },
      )

      await expect
        .poll(async () => (await fakeBdapps.subscriber(user.phone))?.status)
        .toBe('UNREGISTERED')

      await expect
        .poll(() =>
          translogFor(row.id, { app: 'admin' }).find(
            (l) => l.event === 'plan.change' && l.data.cause === 'admin' && l.data.to === 'PRO',
          ),
        )
        .toMatchObject({ data: { from: 'FREE', to: 'PRO', cause: 'admin', changed: true } })

      // Still on Plan history; mutation calls router.refresh() with ?tab=plan.
      const planPanelAfter = admin.page.getByRole('tabpanel')
      const grantRow = planPanelAfter
        .getByRole('listitem')
        .filter({ hasText: /FREE.*PRO/ })
        .filter({ hasText: /Admin/ })
      await expect(grantRow).toBeVisible({ timeout: 15_000 })
      const rowsAfterGrant = await planPanelAfter.getByRole('listitem').count()
      expect(rowsAfterGrant).toBeGreaterThan(rowsBeforeGrant)

      await user.page.reload()
      await expect(user.page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible({
        timeout: 15_000,
      })
    } finally {
      await admin.context.close()
    }
  })
})
