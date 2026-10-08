import { test, expect } from '@playwright/test'
import { gotoQuiet, PHONE_375 } from '../guards/helpers'

test.use({ viewport: PHONE_375 })

test('selecting a day on a phone brings its detail card into view', async ({ page }) => {
  await gotoQuiet(page, '/calendar?month=2026-10')
  await page.getByRole('button', { name: /^(15|16|20)$/ }).first().click()
  const detail = page.getByRole('heading', { level: 3 }).first()
  await expect(detail).toBeVisible()
  await expect(detail).toBeInViewport({ ratio: 1 })
})
