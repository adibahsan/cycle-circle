import { test, expect } from '../../support/fixtures'
import { unusedPhone } from '../../support/users'

test.describe('Phone signup', () => {
  test('a new number verifies a BDApps OTP, becomes a subscriber and lands on onboarding as Pro', async ({ page, fakeBdapps }) => {
    const phone = await unusedPhone()

    await page.goto('/login')
    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page).toHaveURL(/\/verify-otp/)

    // The fake BDApps "sent" a real code; type it the way the user would (it auto-submits).
    const otp = await fakeBdapps.latestOtp(phone)
    expect(otp.kind).toBe('bdapps')
    await page.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)

    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: 'Welcome to Cycle Circle' })).toBeVisible()

    // The app treats the user as Pro…
    const status = await page.request.get('/api/auth/status')
    expect(status.ok()).toBe(true)
    expect((await status.json()).user).toMatchObject({ phone: expect.stringContaining(phone.slice(1)), subscriptionStatus: 'PRO' })

    // …because BDApps subscribed the number: the verify call was made and the fake holds a subscriber with a masked id.
    const verifies = await fakeBdapps.calls({ path: '/subscription/otp/verify' })
    expect(verifies.some((c) => c.body.referenceNo === otp.referenceNo && c.response.statusCode === 'S1000')).toBe(true)
    const subscriber = await fakeBdapps.subscriber(phone)
    expect(subscriber).toMatchObject({ status: 'REGISTERED' })
    expect(subscriber?.maskedId).not.toContain(phone.slice(1))
  })
})
