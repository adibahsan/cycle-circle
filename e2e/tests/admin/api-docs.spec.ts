import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { URLS } from '../../support/slot'

test.describe('Admin API docs', () => {
  test('the API reference page loads with the rendered OpenAPI operations', async ({
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
      await page.goto('/api-docs')
      await expect(page.getByRole('heading', { name: 'API Reference', level: 1 })).toBeVisible()
      await expect(page.getByRole('main').getByRole('link', { name: '/openapi.yaml' }).first()).toBeVisible()
      // Swagger UI rendered the spec (title + at least one operation block).
      // eslint-disable-next-line playwright/no-raw-locators -- third-party Swagger UI markup, no accessible names
      await expect(page.locator('#swagger-ui .info .title')).toBeVisible({ timeout: 20_000 })
      // eslint-disable-next-line playwright/no-raw-locators -- third-party Swagger UI markup, no accessible names
      await expect(page.locator('#swagger-ui .opblock').first()).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  for (const path of ['/openapi.yaml', '/swagger-ui/swagger-ui-bundle.js']) {
    test(`an anonymous request for ${path} is redirected to login`, async ({ playwright }) => {
      const anon = await playwright.request.newContext({ baseURL: URLS.admin })
      try {
        const res = await anon.get(path, { maxRedirects: 0 })
        expect([307, 308]).toContain(res.status())
        expect(res.headers()['location']).toMatch(/\/login$/)
      } finally {
        await anon.dispose()
      }
    })
  }
})
