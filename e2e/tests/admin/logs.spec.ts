import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { unusedPhone } from '../../support/users'
import { URLS } from '../../support/slot'

test.describe('Admin log reader', () => {
  test('the log reader shows the run log lines with OTPs masked', async ({
    browser,
    fakeBdapps,
    request,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    // 1. Produce a real OTP in the run
    const phone = await unusedPhone()
    const since = new Date(Date.now() - 1000)

    const reqRes = await request.post(`${URLS.web}/api/auth/otp/request`, { data: { phone } })
    expect(reqRes.ok()).toBe(true)
    const { referenceNo } = (await reqRes.json()) as { referenceNo: string }

    const otp = await fakeBdapps.latestOtp(phone, { since })
    const rawOtpCode = otp.code
    expect(rawOtpCode).toMatch(/^\d{4,8}$/)

    // Verify the OTP so subscription/otp/verify with the OTP payload is logged to the merchant channel
    const verifyRes = await request.post(`${URLS.web}/api/auth/otp/verify`, {
      data: { referenceNo, otp: rawOtpCode },
    })
    expect(verifyRes.ok()).toBe(true)

    // 2. View in Admin logs
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
      await page.goto(`/logs?channel=merchant&text=${encodeURIComponent(referenceNo)}`)
      await expect(page.getByRole('heading', { name: 'Logs' })).toBeVisible()

      // The log line with the referenceNo must appear
      const logItem = page.locator('li').filter({ hasText: 'subscription/otp/verify' }).first()
      await expect(logItem).toBeVisible({ timeout: 15_000 })

      // Open the details to inspect the raw JSON payload
      // eslint-disable-next-line playwright/no-raw-locators -- native <summary> toggle has no role in Playwright's role engine
      await logItem.locator('summary > span').first().click()
      // eslint-disable-next-line playwright/no-raw-locators -- raw log JSON <pre> has no role or name
      const rawPre = logItem.locator('pre')
      await expect(rawPre).toBeVisible()

      const payloadText = await rawPre.textContent()
      expect(payloadText).toBeTruthy()

      // Prove the OTP is masked and the raw code is absent
      expect(payloadText).toContain('<MASKED>')
      expect(payloadText).not.toContain(rawOtpCode)
    } finally {
      await admin.context.close()
    }
  })
})
