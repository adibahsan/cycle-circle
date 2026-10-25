import { test, expect } from '../../support/fixtures'
import { createThrowawayUser, newPhone } from '../../support/users'

test.describe('Web login and access', () => {
  test('an existing subscriber logs in with an App OTP, and no new subscribe call is recorded', async ({ browser, page, fakeBdapps, db }) => {
    // 1. Create an existing subscriber with a throwaway user
    const { phone, context: initialContext } = await createThrowawayUser(browser, {}, fakeBdapps)
    await initialContext.close()

    // Age the initial challenge so the 60-second cooldown doesn't block the next request
    await db.otpChallenge.updateMany({
      where: { phone: { contains: phone.slice(1) } },
      data: { createdAt: new Date(Date.now() - 70_000) },
    })

    const callsBefore = await fakeBdapps.calls()
    const sinceSeq = callsBefore.length > 0 ? callsBefore[callsBefore.length - 1].seq : 0

    // 2. Returning subscriber requests login OTP
    await page.goto('/login')
    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page).toHaveURL(/\/verify-otp/)

    // 3. Fake BDApps sent an App OTP by SMS (kind = 'app')
    const otp = await fakeBdapps.latestOtp(phone, { since: new Date(Date.now() - 5000) })
    expect(otp.kind).toBe('app')

    // 4. Fill the 6-digit code (auto-submits)
    await page.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)

    // Lands on onboarding (throwaway user has no profile yet)
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: 'Welcome to Cycle Circle' })).toBeVisible()

    // User is logged in as PRO
    const status = await page.request.get('/api/auth/status')
    expect(status.ok()).toBe(true)
    expect((await status.json()).user).toMatchObject({
      phone: expect.stringContaining(phone.slice(1)),
      subscriptionStatus: 'PRO',
    })

    // No new subscribe calls recorded for this subscriber
    const subscriber = await fakeBdapps.subscriber(phone)
    expect(subscriber).toBeDefined()
    const newCalls = await fakeBdapps.calls({ sinceSeq })
    const subscribeCalls = newCalls.filter(
      (c) =>
        (c.path === '/subscription/send' && c.body?.subscriberId === subscriber?.maskedId) ||
        (c.path === '/subscription/otp/verify' && c.body?.referenceNo === otp.referenceNo),
    )
    expect(subscribeCalls).toHaveLength(0)

    // An SMS was sent to this subscriber
    const smsCalls = newCalls.filter(
      (c) =>
        c.path === '/sms/send' &&
        Array.isArray(c.body?.destinationAddresses) &&
        c.body.destinationAddresses.includes(subscriber?.maskedId),
    )
    expect(smsCalls.length).toBeGreaterThanOrEqual(1)
  })

  test('a wrong OTP shows an error and does not log in', async ({ page, fakeBdapps }) => {
    const phone = newPhone()

    await page.goto('/login')
    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page).toHaveURL(/\/verify-otp/)

    const otp = await fakeBdapps.latestOtp(phone)
    const wrongCode = otp.code === '000000' ? '999999' : '000000'

    await page.getByRole('textbox', { name: 'Digit 1' }).fill(wrongCode)

    const alert = page.getByRole('alert').filter({ hasText: /Invalid or expired code/ })
    await expect(alert).toBeVisible()

    await expect(page).toHaveURL(/\/verify-otp/)
    const status = await page.request.get('/api/auth/status')
    expect(status.status()).toBe(401)
  })

  test('an expired OTP shows an error and does not log in', async ({ page, fakeBdapps, db }) => {
    const phone = newPhone()

    await page.goto('/login')
    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page).toHaveURL(/\/verify-otp/)

    const otp = await fakeBdapps.latestOtp(phone)

    await db.otpChallenge.updateMany({
      where: { phone: { contains: phone.slice(1) } },
      data: { expiresAt: new Date(Date.now() - 10_000) },
    })

    await page.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)

    const alert = page.getByRole('alert').filter({ hasText: /Invalid or expired code/ })
    await expect(alert).toBeVisible()

    await expect(page).toHaveURL(/\/verify-otp/)
    const status = await page.request.get('/api/auth/status')
    expect(status.status()).toBe(401)
  })

  test('the 60-second resend cooldown is enforced and shown', async ({ page }) => {
    const phone = newPhone()

    await page.goto('/login')
    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page).toHaveURL(/\/verify-otp/)

    // On verify-otp, the resend button is disabled and shows countdown
    const resendBtn = page.getByRole('button', { name: /Resend in \d+s/ })
    await expect(resendBtn).toBeVisible()
    await expect(resendBtn).toBeDisabled()

    // Requesting a new code for the same phone before cooldown expires shows an error
    await page.goto('/login')
    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()

    const alert = page.getByRole('alert').filter({ hasText: /Please wait a moment before requesting another code/ })
    await expect(alert).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('the per-phone rate limit is enforced and shown after exceeding 3 requests in 60s', async ({ page, db }) => {
    const phone = newPhone()

    // First 3 requests: succeed (bypassing cooldown by removing the previous DB challenge)
    for (let i = 1; i <= 3; i++) {
      await page.goto('/login')
      await page.getByLabel('Phone Number').fill(phone)
      await page.getByRole('button', { name: 'Send OTP' }).click()
      await expect(page).toHaveURL(/\/verify-otp/)
      await db.otpChallenge.deleteMany({ where: { phone: { contains: phone.slice(1) } } })
    }

    // 4th request: rate limiter blocks it (3 requests per 60s per phone)
    await page.goto('/login')
    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()

    const alert = page.getByRole('alert').filter({ hasText: /Too many attempts/ })
    await expect(alert).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('repeated wrong codes trigger the brute-force block', async ({ page, fakeBdapps }) => {
    const phone = newPhone()

    await page.goto('/login')
    await page.getByLabel('Phone Number').fill(phone)
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page).toHaveURL(/\/verify-otp/)

    const otp = await fakeBdapps.latestOtp(phone)

    // 5 failed verification attempts (wait for each verify response so attempts don't drop while loading)
    for (let i = 1; i <= 5; i++) {
      const wrongCode = String(100000 + i)
      const resPromise = page.waitForResponse((r) => r.url().includes('/api/auth/otp/verify'))
      await page.getByRole('textbox', { name: 'Digit 1' }).fill(wrongCode)
      await resPromise
      const alert = page.getByRole('alert').filter({ hasText: /Invalid or expired code/ })
      await expect(alert).toBeVisible()
    }

    // 6th attempt: triggers the rate limit brute-force block
    const blockPromise = page.waitForResponse((r) => r.url().includes('/api/auth/otp/verify'))
    await page.getByRole('textbox', { name: 'Digit 1' }).fill('100006')
    const blockedRes = await blockPromise
    expect(blockedRes.status()).toBe(429)

    const blockedAlert = page.getByRole('alert').filter({ hasText: /Too many attempts/ })
    await expect(blockedAlert).toBeVisible()

    // Even if the valid code is now entered, the session remains blocked
    const validBlockedPromise = page.waitForResponse((r) => r.url().includes('/api/auth/otp/verify'))
    await page.getByRole('textbox', { name: 'Digit 1' }).fill(otp.code)
    const validBlockedRes = await validBlockedPromise
    expect(validBlockedRes.status()).toBe(429)
    await expect(blockedAlert).toBeVisible()

    await expect(page).toHaveURL(/\/verify-otp/)
    const status = await page.request.get('/api/auth/status')
    expect(status.status()).toBe(401)
  })

  test('logout ends the session; a protected page then redirects to login', async ({ newUser }) => {
    const { page } = await newUser()

    await page.goto('/settings')
    await page.getByRole('button', { name: 'Log Out' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Log Out' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Log Out' }).click()
    await expect(page).toHaveURL(/\/login/)

    // Visiting a protected route redirects to login
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)

    // Auth status confirms session is ended
    const status = await page.request.get('/api/auth/status')
    expect(status.status()).toBe(401)
  })

  test('every protected page redirects a logged-out visitor to login', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/calendar',
      '/symptoms',
      '/insights',
      '/content',
      '/feedback',
      '/profiles',
      '/settings',
      '/subscription',
      '/onboarding',
    ]

    for (const route of protectedRoutes) {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/)
    }
  })
})
