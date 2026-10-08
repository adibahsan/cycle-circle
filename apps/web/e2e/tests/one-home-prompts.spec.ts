/**
 * Guard for ticket #42 (one home per prompt). Counts prompt instances per page; saves nothing.
 * Run: pnpm --filter @vesta/web e2e e2e/tests/one-home-prompts.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { statePath } from '../support/auth'
import { mockApi, settle, suppressAutoPrompts } from '../guards/helpers'

const ROUTES = ['/dashboard', '/calendar', '/symptoms', '/insights', '/settings', '/profiles']

const completionRows = (page: Page) => page.locator('[data-testid="completion-row"]')
// The retired top-of-page banner was a toggle button wired to this panel pattern.
const legacyBanner = (page: Page) => page.locator('button[aria-expanded][aria-label*="%"]')
const checkInButtons = (page: Page) => page.getByRole('button', { name: /^check in$/i })

test.describe('profile completion has one home', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, ['free-user', 'incomplete-profile'])
    await suppressAutoPrompts(page)
  })

  for (const route of ROUTES) {
    test(`${route}: no top banner`, async ({ page }) => {
      await page.goto(route)
      await settle(page, 1500)
      await expect(legacyBanner(page)).toHaveCount(0)
      if (route !== '/dashboard') await expect(completionRows(page)).toHaveCount(0)
    })
  }

  test('dashboard: at most one completion row', async ({ page }) => {
    await page.goto('/dashboard')
    await settle(page, 1500)
    expect(await completionRows(page).count()).toBeLessThanOrEqual(1)
  })
})

test.describe('check-in prompts (fresh persona, not checked in today)', () => {
  test.use({ storageState: statePath('fresh') })

  test('dashboard shows exactly one visible check-in button, and no other page asks', async ({ page }) => {
    await suppressAutoPrompts(page)
    await page.goto('/dashboard')
    await settle(page, 1500)
    await expect(checkInButtons(page)).toHaveCount(1)
    for (const route of ['/calendar', '/symptoms']) {
      await page.goto(route)
      await settle(page, 1000)
      await expect(checkInButtons(page)).toHaveCount(0)
    }
  })

  test('logging nudge never renders on the calendar', async ({ page }) => {
    await suppressAutoPrompts(page)
    await page.goto('/calendar')
    await settle(page, 1500)
    await expect(page.locator('[data-testid="logging-nudge"]')).toHaveCount(0)
  })
})
