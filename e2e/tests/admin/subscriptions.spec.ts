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
    // OTP signup creates a PRO subscription; demote a second throwaway to FREE via DB.
    const pro = await newUser()
    const free = await newUser()
    const proMarker = `E2E SubPro ${pro.phone.slice(-6)}`
    const freeMarker = `E2E SubFree ${free.phone.slice(-6)}`

    const proUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(pro.phone) } })
    const freeUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(free.phone) } })
    await e2eDb().user.update({ where: { id: proUser.id }, data: { fullName: proMarker } })
    await e2eDb().user.update({ where: { id: freeUser.id }, data: { fullName: freeMarker } })
    await setUserSubscription({ userId: freeUser.id, status: 'FREE' })
    // Bump updatedAt so both land on page 1 (list sorts by updatedAt desc).
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
      await page.goto('/subscriptions')
      await expect(page.getByRole('heading', { name: 'Subscriptions', exact: true })).toBeVisible()

      // Status filter keys into unstable_cache — Refresh after each change so DB
      // writes from this test (fullName / FREE demotion) are not masked by a stale entry.
      await page.getByRole('combobox', { name: /Status/ }).click()
      await page.getByRole('option', { name: 'PRO' }).click()
      await expect(page).toHaveURL(/status=PRO/)
      await page.getByRole('button', { name: 'Refresh data' }).click()
      await expect(page.getByText(proMarker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(freeMarker)).toHaveCount(0)

      await page.getByRole('combobox', { name: /Status/ }).click()
      await page.getByRole('option', { name: 'FREE' }).click()
      await expect(page).toHaveURL(/status=FREE/)
      await page.getByRole('button', { name: 'Refresh data' }).click()
      await expect(page.getByText(freeMarker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(proMarker)).toHaveCount(0)
    } finally {
      await admin.context.close()
    }
  })
})
