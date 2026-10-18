/**
 * Guard for ticket #75 (Phase pattern card on the dashboard).
 * Run: pnpm --filter @vesta/web e2e -- e2e/tests/phase-pattern.spec.ts
 * Read-only. The seed persona needs the #75 seed rows (a completed past cycle
 * with logs in every phase): re-run `pnpm --filter @vesta/shared db:seed` if missing.
 */
import { test, expect } from '@playwright/test'
import { DESKTOP, PHONE_375, gotoQuiet } from '../guards/helpers'
import { statePath } from '../support/auth'

for (const [label, viewport] of [['desktop', DESKTOP], ['375x667', PHONE_375]] as const) {
  test.describe(`phase pattern — seed persona (${label})`, () => {
    test.use({ viewport })

    test('shows the most-logged symptoms for the current phase', async ({ page }) => {
      await gotoQuiet(page, '/dashboard')
      const card = page.getByTestId('phase-pattern')
      await expect(card).toBeVisible({ timeout: 15_000 })
      await expect(card.getByRole('heading', { name: 'Your phase pattern' })).toBeVisible()
      const items = page.getByTestId('phase-pattern-list').locator('li')
      await expect(items.first()).toBeVisible()
      expect(await items.count()).toBeLessThanOrEqual(3)
      await expect(items.first()).toContainText(/Logged \d+ times?/)
      await expect(card).not.toContainText(/forecast|might feel/i)
    })
  })
}

test.describe('phase pattern — fresh persona', () => {
  test.use({ storageState: statePath('fresh'), viewport: DESKTOP })

  test('explains the empty state', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    const empty = page.getByTestId('phase-pattern-empty')
    await expect(empty).toBeVisible({ timeout: 15_000 })
    await expect(empty).toContainText('Log your symptoms this cycle to see your pattern next time.')
    await expect(empty.getByRole('link', { name: 'Log symptoms' })).toHaveAttribute('href', '/symptoms')
  })
})
