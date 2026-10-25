import { test, expect } from '../../support/fixtures'
import {
  createAdminUser,
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
})
