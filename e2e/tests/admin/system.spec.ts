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
})
