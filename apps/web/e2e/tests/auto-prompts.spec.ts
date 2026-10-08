/**
 * Guard for ticket #38 (auto-prompt arbiter).
 * Run: pnpm --filter @vesta/web e2e e2e/tests/auto-prompts.spec.ts
 */
import { test, expect } from '@playwright/test'
import { mockApi, settle } from '../guards/helpers'

const visibleDialogs = (page: import('@playwright/test').Page) =>
  page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible')

test('late alert, check-in and profile prompt all eligible: exactly one auto-prompt is visible', async ({ page }) => {
  await mockApi(page, ['free-user', 'late-period', 'incomplete-profile'])
  await page.goto('/dashboard')
  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 20_000 })
  await settle(page, 2500)
  await expect(visibleDialogs(page)).toHaveCount(1)
  await expect(page.getByRole('alertdialog')).toBeVisible()
})

test('closing the late alert does not let a lower-priority prompt open in the same visit', async ({ page }) => {
  await mockApi(page, ['free-user', 'late-period', 'incomplete-profile'])
  await page.goto('/dashboard')
  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 20_000 })
  await page.keyboard.press('Escape')
  await expect(visibleDialogs(page)).toHaveCount(0)
  await settle(page, 2500)
  await expect(visibleDialogs(page)).toHaveCount(0)
})

test('trial expired: only the trial lock is visible and nothing opens over it', async ({ page }) => {
  await mockApi(page, ['trial-expired', 'late-period', 'incomplete-profile'])
  await page.goto('/dashboard')
  const lock = page.locator('[aria-labelledby="trial-expired-title"]')
  await expect(lock).toBeVisible({ timeout: 20_000 })
  await settle(page, 2500)
  await expect(visibleDialogs(page)).toHaveCount(1)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('vesta:open-period-log')))
  await settle(page, 800)
  await expect(visibleDialogs(page)).toHaveCount(1)
  await expect(lock).toBeVisible()
})
