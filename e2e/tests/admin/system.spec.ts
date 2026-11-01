import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'
import { SECRETS, URLS } from '../../support/slot'

// The caas-check cron setting is global to the slot DB. Restore it in finally.
test.describe('Admin system', () => {
  test('a cron setting changed in System is saved after reload and applied by the cron route', async ({
    browser,
    request,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    test.slow()
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })
    const slug = 'caas-check'
    const before = await e2eDb().cronSetting.findUnique({ where: { slug } })
    const wasEnabled = before?.enabled ?? true
    const toggleName = 'Daily schedule for Daily subscription check'

    try {
      const { page } = admin
      await page.goto('/system')
      await expect(page.getByRole('heading', { name: 'System', level: 1 })).toBeVisible()
      const toggle = page.getByRole('switch', { name: toggleName })
      await expect(toggle).toHaveAttribute('aria-checked', String(wasEnabled))

      // Turn the schedule off (unless it already is, then on).
      const target = !wasEnabled
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', String(target))
      await expect(toggle).toBeEnabled() // server action finished

      // Saved after reload
      await page.reload()
      await expect(page.getByRole('switch', { name: toggleName })).toHaveAttribute(
        'aria-checked',
        String(target),
      )

      // Applied: the scheduled cron route honours the setting.
      const res = await request.get(`${URLS.web}/api/cron/${slug}`, {
        headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
      })
      expect(res.ok()).toBe(true)
      const body = (await res.json()) as { skipped?: boolean; reason?: string }
      if (target === false) {
        expect(body.skipped).toBe(true)
        expect(body.reason).toBe('cron disabled')
      } else {
        expect(body.skipped).toBeUndefined()
      }
    } finally {
      const { page } = admin
      await page.goto('/system')
      const toggle = page.getByRole('switch', { name: toggleName })
      if ((await toggle.getAttribute('aria-checked')) !== String(wasEnabled)) {
        await toggle.click()
        await expect(toggle).toHaveAttribute('aria-checked', String(wasEnabled))
        await expect(toggle).toBeEnabled()
      }
      await admin.context.close()
    }
  })

  test('the SMS daily send time is set in Bangladesh time, saved after reload and audited', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    // The send time is one global row that sms.spec.ts's cron test needs to be already passed.
    // Every value written here is 00:00 or 00:01 Bangladesh time and the test ends on 00:00, so a
    // parallel cron test never sees a future send time. Viewport-independent: desktop only, so the
    // phone project doesn't write the same row at the same moment. Each `pnpm e2e` run resets the DB.
    test.skip(isMobile, 'viewport-independent; one writer of the global send-time row')
    const key = 'sms.dailySendTime'
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
      await page.goto('/system')
      for (const [bd, utc] of [['00:01', '18:01'], ['00:00', '18:00']] as const) {
        const input = page.getByLabel('Send time (Bangladesh)')
        await expect(input).toBeVisible()
        // Save stays disabled until the value differs from the saved one, and a fill that lands
        // before hydration never reaches React state (#229). Fill until Save enables.
        const save = page.getByRole('button', { name: 'Save', exact: true })
        await expect(async () => {
          await input.fill(bd, { timeout: 3_000 })
          await expect(save).toBeEnabled({ timeout: 1_000 })
        }).toPass({ timeout: 20_000 })
        await save.click()
        // Shown in Bangladesh time, with the same moment in UTC (the previous day)
        await expect(page.getByText(`Current: ${bd} Bangladesh time (${utc} UTC)`, { exact: false })).toBeVisible()
        await page.reload()
        await expect(page.getByLabel('Send time (Bangladesh)')).toHaveValue(bd)
        expect((await e2eDb().systemSetting.findUniqueOrThrow({ where: { key } })).value).toBe(bd)
      }
      const log = await e2eDb().adminAuditLog.findFirst({
        where: { action: 'SET_SMS_SEND_TIME', targetId: key },
        orderBy: { createdAt: 'desc' },
      })
      expect(log).not.toBeNull()
    } finally {
      await admin.context.close()
    }
  })
  test('the Pro price is set with a warning and an effective day, kept in history and audited', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    // One writer of the ProPrice table. The entry takes effect in 2099 so the price in effect today
    // stays 5 taka a day for every other spec; it is removed in finally.
    test.skip(isMobile, 'viewport-independent; one writer of the price table')
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })
    const day = '2099-01-01'
    try {
      const { page } = admin
      await page.goto('/system')
      await expect(page.getByRole('heading', { name: 'Pro price', level: 2 })).toBeVisible()
      await expect(page.getByText('Current: ৳5/day')).toBeVisible()
      await expect(page.getByText('This does not change what BDApps charges', { exact: false })).toBeVisible()

      // Invalid price is refused by the server and nothing is saved
      await page.getByLabel('Amount (taka)').fill('-1')
      await page.getByLabel('Takes effect (Bangladesh day)').fill(day)
      await page.getByRole('button', { name: 'Set price', exact: true }).click()
      await expect(page.getByText('Price must be a number greater than 0')).toBeVisible()
      // After a reload the history shows the seeded price and no row for the refused day
      await page.reload()
      const history = page.getByRole('table', { name: 'Pro price history' })
      await expect(history.getByRole('row', { name: /In effect.*2000-01-01/ })).toBeVisible()
      await expect(history.getByRole('row', { name: new RegExp(day) })).toHaveCount(0)

      await page.getByLabel('Amount (taka)').fill('7.5')
      await page.getByLabel('Takes effect (Bangladesh day)').fill(day)
      await page.getByRole('button', { name: 'Set price', exact: true }).click()
      await expect(history.getByRole('row', { name: /৳7\.5\/day.*Scheduled.*2099-01-01/ })).toBeVisible()

      // Kept after reload; the price in effect today is unchanged
      await page.reload()
      await expect(history.getByRole('row', { name: /৳7\.5\/day.*2099-01-01/ })).toBeVisible()
      await expect(history.getByRole('row', { name: /৳5\/day.*In effect.*2000-01-01/ })).toBeVisible()

      const log = await e2eDb().adminAuditLog.findFirst({
        where: { action: 'PRO_PRICE_SET', targetType: 'ProPrice' },
        orderBy: { createdAt: 'desc' },
      })
      expect(log).not.toBeNull()
    } finally {
      await e2eDb().proPrice.deleteMany({ where: { effectiveFrom: new Date(`${day}T00:00:00Z`) } })
      await admin.context.close()
    }
  })
})
