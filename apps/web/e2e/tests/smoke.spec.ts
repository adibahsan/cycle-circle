import { test, expect } from '@playwright/test'
import { gotoQuiet, expectNoHorizontalOverflow } from '../guards/helpers'

test('dashboard loads for the seed user', async ({ page }) => {
  await gotoQuiet(page, '/dashboard')
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.locator('main')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
