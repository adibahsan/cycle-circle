import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb, setUserSubscription } from '../../support/db'
import { toDbPhone } from '../../support/users'

test.describe('Admin subscriptions', () => {
  test('the list filters by status', async ({
    browser,
    newUser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const pro = await newUser()
    const free = await newUser()
    const proMarker = `E2E SubPro ${pro.phone.slice(-6)}`
    const freeMarker = `E2E SubFree ${free.phone.slice(-6)}`

    const proUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(pro.phone) } })
    const freeUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(free.phone) } })
    await e2eDb().user.update({ where: { id: proUser.id }, data: { fullName: proMarker } })
    await e2eDb().user.update({ where: { id: freeUser.id }, data: { fullName: freeMarker } })
    // OTP signup is Pro; set both sides explicitly so the filter assertion is not implicit.
    await setUserSubscription({ userId: proUser.id, status: 'PRO' })
    await setUserSubscription({ userId: freeUser.id, status: 'FREE' })
    // Bump updatedAt so both land near the top (list sorts by updatedAt desc).
    const now = new Date()
    await e2eDb().subscription.updateMany({
      where: { userId: { in: [proUser.id, freeUser.id] } },
      data: { updatedAt: now },
    })

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
      // pageSize=100: parallel workers can push unique markers off the default page of 20.
      await page.goto('/subscriptions?pageSize=100')
      await expect(page.getByRole('heading', { name: 'Subscriptions', exact: true })).toBeVisible()

      // Status filter keys into unstable_cache — Refresh after each change so DB
      // writes from this test (fullName / FREE demotion) are not masked by a stale entry.
      await page.getByRole('combobox', { name: 'Status:' }).click()
      await page.getByRole('option', { name: 'PRO' }).click()
      await expect(page).toHaveURL(/status=PRO/)
      await page.getByRole('button', { name: 'Refresh data' }).click()
      await expect(page.getByText(proMarker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(freeMarker)).toHaveCount(0)
      // Scope to the marker's list row (Status Breakdown pie/table also contains "PRO").
      const proRow = page.getByRole('row').filter({ has: page.getByText(proMarker) })
      await expect(proRow.getByText('PRO', { exact: true })).toBeVisible()

      await page.getByRole('combobox', { name: 'Status:' }).click()
      await page.getByRole('option', { name: 'FREE' }).click()
      await expect(page).toHaveURL(/status=FREE/)
      await page.getByRole('button', { name: 'Refresh data' }).click()
      await expect(page.getByText(freeMarker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(proMarker)).toHaveCount(0)
      // StatusBadge renders FREE as title-case "Free".
      const freeRow = page.getByRole('row').filter({ has: page.getByText(freeMarker) })
      await expect(freeRow.getByText('Free', { exact: true })).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('the table and user detail show when BDApps last confirmed a subscriber, in Bangladesh time', async ({
    browser,
    newUser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const confirmed = await newUser()
    const never = await newUser()
    const confirmedMarker = `E2E LastConf ${confirmed.phone.slice(-6)}`
    const neverMarker = `E2E NeverConf ${never.phone.slice(-6)}`
    const confirmedUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(confirmed.phone) } })
    const neverUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(never.phone) } })
    await e2eDb().user.update({ where: { id: confirmedUser.id }, data: { fullName: confirmedMarker } })
    await e2eDb().user.update({ where: { id: neverUser.id }, data: { fullName: neverMarker } })
    await setUserSubscription({ userId: confirmedUser.id, status: 'PRO' })
    await setUserSubscription({ userId: neverUser.id, status: 'PRO' })
    // 18:30 UTC on the 10th is 00:30 on the 11th in Bangladesh.
    await e2eDb().subscription.updateMany({
      where: { userId: confirmedUser.id },
      data: { lastConfirmedAt: new Date('2026-06-10T18:30:00Z'), lastReportedStatus: 'REGISTERED', updatedAt: new Date() },
    })
    await e2eDb().subscription.updateMany({
      where: { userId: neverUser.id },
      data: { lastConfirmedAt: null, lastReportedStatus: null, updatedAt: new Date() },
    })

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
      // The strip's numbers depend on the global latest run (checked in the serial cron spec);
      // here it only has to be there, with no CaaS wording.
      await page.goto('/subscriptions?pageSize=97')
      await expect(page.getByTestId('check-strip')).toBeVisible()
      await expect(page.getByText(/caas/i)).toHaveCount(0)
      await expect(page.getByRole('columnheader', { name: 'Last confirmed by BDApps' })).toBeVisible()

      const confirmedRow = page.getByRole('row').filter({ has: page.getByText(confirmedMarker) })
      await expect(confirmedRow.getByTestId('last-confirmed')).toContainText(/Jun 11, 2026.*12:30 AM/)
      await expect(confirmedRow.getByTestId('last-confirmed')).toContainText('REGISTERED')
      const neverRow = page.getByRole('row').filter({ has: page.getByText(neverMarker) })
      await expect(neverRow.getByTestId('last-confirmed')).toHaveText('never')

      await page.goto(`/users/${confirmedUser.id}?tab=subscription`)
      await expect(page.getByTestId('last-confirmed')).toContainText(/Last confirmed by BDApps/)
      await expect(page.getByTestId('last-confirmed')).toContainText(/Jun 11, 2026.*12:30 AM \(reported REGISTERED\)/)
      await page.goto(`/users/${neverUser.id}?tab=subscription`)
      await expect(page.getByTestId('last-confirmed')).toContainText('never')
    } finally {
      await admin.context.close()
    }
  })
})
