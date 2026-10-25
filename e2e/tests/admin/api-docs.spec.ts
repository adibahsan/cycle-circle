import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'

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
      await expect(page.locator('#swagger-ui .info .title')).toBeVisible({ timeout: 20_000 })
      await expect(page.locator('#swagger-ui .opblock').first()).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })
})
