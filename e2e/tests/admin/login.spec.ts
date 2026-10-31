import { request as pwRequest } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { URLS } from '../../support/slot'
import {
  createAdminUser,
  createLoggedInAdmin,
  createNonAdminEmailUser,
  loginAsAdminViaUi,
  setAdminCookie,
  signAdminAudienceToken,
} from '../../support/admin'

test.describe('Admin login', () => {
  test('an admin created in the E2E DB signs in with email and password and reaches the dashboard', async ({
    page,
  }) => {
    const admin = await createAdminUser()

    await loginAsAdminViaUi(page, admin)

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('wrong password shows a visible error and stays on login', async ({ page }) => {
    const admin = await createAdminUser()

    await page.goto('/login')
    await page.getByLabel('Email').fill(admin.email)
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Prefer text over role=alert: Next.js route announcer also uses role="alert".
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated visit to the dashboard redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Cycle Circle Admin' })).toBeVisible()
  })

  test('a non-admin submitting the login form sees a visible error', async ({ page }) => {
    const user = await createNonAdminEmailUser()

    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill(user.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // verifyAdminLogin refuses non-admins with the same message as bad credentials.
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('a non-admin with a valid admin-audience session sees the forbidden page', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const user = await createNonAdminEmailUser()
    const token = await signAdminAudienceToken({
      sub: user.id,
      email: user.email,
      role: 'USER',
    })

    const context = await browser.newContext({
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })
    await setAdminCookie(context, token)
    const page = await context.newPage()

    try {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Not an admin' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Log out and switch account' })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('Sign out ends the admin session and returns to login', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
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
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

      const openMenu = page.getByRole('button', { name: 'Open menu' })
      if (await openMenu.isVisible()) {
        await openMenu.click()
      }
      await page.getByRole('button', { name: /Sign out|Log out/ }).click()

      await expect(page).toHaveURL(/\/login/)
      await page.goto('/')
      await expect(page).toHaveURL(/\/login/)
    } finally {
      await admin.context.close()
    }
  })

  test.describe('login hardening (#188)', () => {
    test('the 6th failed login for one email gets 429, even with the right password', async () => {
      const admin = await createAdminUser()
      const api = await pwRequest.newContext({ baseURL: URLS.admin })
      try {
        for (let i = 0; i < 5; i++) {
          const res = await api.post('/api/auth/login', { data: { email: admin.email, password: `wrong-${i}` } })
          expect(res.status()).toBe(401)
        }
        const blocked = await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
        expect(blocked.status()).toBe(429)
      } finally {
        await api.dispose()
      }
    })

    test('a malformed body gets 400, not 500', async () => {
      const api = await pwRequest.newContext({ baseURL: URLS.admin })
      try {
        const objectEmail = await api.post('/api/auth/login', { data: { email: {} } })
        expect(objectEmail.status()).toBe(400)
        const missing = await api.post('/api/auth/login', { data: { email: 'a@b.test' } })
        expect(missing.status()).toBe(400)
        const notJson = await api.post('/api/auth/login', { headers: { 'content-type': 'application/json' }, data: '{nope' })
        expect(notJson.status()).toBe(400)
      } finally {
        await api.dispose()
      }
    })

    test('an admin stored in lowercase logs in with a mixed-case email', async () => {
      const admin = await createAdminUser()
      const mixed = admin.email.charAt(0).toUpperCase() + admin.email.slice(1)
      expect(mixed).not.toBe(admin.email)
      const api = await pwRequest.newContext({ baseURL: URLS.admin })
      try {
        const res = await api.post('/api/auth/login', { data: { email: ` ${mixed} `, password: admin.password } })
        expect(res.status()).toBe(200)
      } finally {
        await api.dispose()
      }
    })
  })
})
