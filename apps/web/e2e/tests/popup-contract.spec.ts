/**
 * Pop-up contract sweep (ticket #41): the pop-ups not already proven by a per-ticket guard.
 * The full list, and which spec covers each pop-up, is e2e/support/popup-registry.ts.
 * Contract: ESC closes it (except the lock), Tab stays inside, focus returns to the trigger, the page behind does not scroll.
 * Run: pnpm e2e e2e/tests/popup-contract.spec.ts
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  PHONE_375,
  dialog,
  expectDialogA11y,
  expectScrollLocked,
  expectScrollUnlocked,
  expectTabTrap,
  gotoQuiet,
  openPopup,
  settle,
} from '../guards/helpers'

interface Case {
  id: string
  route: string
  phone?: boolean
  trigger: (page: Page) => Locator
}

const CASES: Case[] = [
  {
    id: 'period-log-edit',
    route: '/calendar',
    trigger: (p) => p.locator('button[aria-label^="Edit period log"]:visible').first(),
  },
  {
    id: 'more-sheet',
    route: '/dashboard',
    phone: true,
    trigger: (p) => p.locator('nav button[aria-haspopup="dialog"]:visible').first(),
  },
]

for (const c of CASES) {
  test.describe(`pop-up contract: ${c.id}`, () => {
    if (c.phone) test.use({ viewport: PHONE_375 })

    async function open(page: Page) {
      await gotoQuiet(page, c.route)
      const trigger = c.trigger(page)
      await expect(trigger).toBeVisible({ timeout: 15_000 })
      const d = await openPopup(page, trigger)
      return { trigger, d }
    }

    test('ESC closes, focus returns, scroll unlocks', async ({ page }) => {
      const { trigger, d } = await open(page)
      await expectDialogA11y(d)
      await page.keyboard.press('Escape')
      await expect(dialog(page)).toBeHidden()
      await expect(trigger).toBeFocused()
      await expectScrollUnlocked(page)
    })

    test('Tab stays inside, page behind is locked', async ({ page }) => {
      const { d } = await open(page)
      await expectTabTrap(page, d)
      await expectScrollLocked(page)
    })
  })
}

test.describe('pop-up contract: onboarding-tour', () => {
  // The tour is a spotlight over live page elements, so the page stays scrollable by design (no scroll-lock check).
  test('replay opens a dialog; Tab stays inside; ESC closes it', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e_tour_armed')) {
        sessionStorage.setItem('e2e_tour_armed', '1')
        sessionStorage.setItem('vesta_replay_tour', '1')
      }
    })
    await gotoQuiet(page, '/dashboard')
    const d = page.locator('[role="dialog"][aria-labelledby^="tour-title-"]')
    await expect(d).toBeVisible({ timeout: 20_000 })
    await expectDialogA11y(d)
    await expectTabTrap(page, d, 6)
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
    await settle(page, 300)
  })
})
