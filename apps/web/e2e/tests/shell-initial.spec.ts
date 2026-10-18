/**
 * Guard: the signed-in shell gets account, logging and completion data streamed from the
 * server layout, so pop-ups decide without the three client round trips.
 * Run: pnpm --filter @vesta/web e2e e2e/tests/shell-initial.spec.ts
 */
import { test, expect } from '@playwright/test'
import { statePath } from '../support/auth'

const SHELL_APIS = /\/api\/(auth\/status|tracking\/logging-status|profile\/completion)(\?|$)/

test.use({ storageState: statePath('late') })

test('late alert opens from server data, with no client shell fetches', async ({ page }) => {
  const shellCalls: string[] = []
  page.on('request', (r) => {
    if (SHELL_APIS.test(r.url())) shellCalls.push(r.url())
  })
  await page.goto('/dashboard')
  await expect(page.locator('[aria-labelledby="late-alert-title"]')).toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  expect(shellCalls).toEqual([])
})

test('profile chip shows the profile name, never the generic label', async ({ page }) => {
  await page.goto('/settings')
  const chip = page.locator('.sb-chip:visible').first()
  await expect(chip).toBeVisible()
  await expect(chip).not.toContainText('Profile')
})
