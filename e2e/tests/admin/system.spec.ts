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
        await input.fill(bd)
        await page.getByRole('button', { name: 'Save', exact: true }).click()
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
})
