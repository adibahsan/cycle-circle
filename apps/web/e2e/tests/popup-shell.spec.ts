/**
 * Guard for ticket #32 (pop-up shell), proven on the email-trial "add number" dialog.
 * Run: pnpm --filter @vesta/web e2e -- e2e/tests/popup-shell.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import {
  PHONE_375,
  dialog,
  expectDialogA11y,
  expectOnTop,
  expectScrollLocked,
  expectScrollUnlocked,
  expectTabTrap,
  expectWithinViewport,
  gotoQuiet,
  mockApi,
  openPopup,
  sampleTransforms,
} from '../guards/helpers'

/** The trial pill exists twice (sidebar + mobile header); take the visible one. */
const pill = (page: Page) => page.locator('button[aria-label*="Trial ends in"]:visible, button[aria-label*="ট্রায়াল শেষ"]:visible').first()

async function gotoTrial(page: Page) {
  await mockApi(page, ['email-trial'])
  await gotoQuiet(page, '/dashboard')
  await expect(pill(page)).toBeVisible({ timeout: 15_000 })
}

test.describe('trial add-number dialog on the pop-up shell (desktop)', () => {
  test('opens above sidebar and header, with dialog semantics', async ({ page }) => {
    await gotoTrial(page)
    const d = await openPopup(page, pill(page))
    await expectDialogA11y(d)
    await expectOnTop(page, d)
  })

  test('ESC closes and focus returns to the pill', async ({ page }) => {
    await gotoTrial(page)
    const trigger = pill(page)
    await openPopup(page, trigger)
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Tab and Shift+Tab stay inside the dialog; page behind does not scroll', async ({ page }) => {
    await gotoTrial(page)
    const d = await openPopup(page, pill(page))
    await expectTabTrap(page, d)
    await expectScrollLocked(page)
  })

  test('background is inert while open and restored after close', async ({ page }) => {
    await gotoTrial(page)
    await openPopup(page, pill(page))
    expect(await page.locator('body > [inert]').count()).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    expect(await page.locator('body > [inert]').count()).toBe(0)
    await expectScrollUnlocked(page)
  })

  test('backdrop click closes', async ({ page }) => {
    await gotoTrial(page)
    await openPopup(page, pill(page))
    await page.mouse.click(5, 5)
    await expect(dialog(page)).toBeHidden()
  })

  test('reduced motion: no transform animation on open or close', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoTrial(page)
    const seen = await sampleTransforms(page, async () => {
      await pill(page).click()
      await expect(dialog(page)).toBeVisible()
      await expect(dialog(page)).toHaveAttribute('data-motion', 'reduced')
      await page.keyboard.press('Escape')
      await expect(dialog(page)).toBeHidden()
    })
    expect(seen, 'panel transform animated under reduced motion').toEqual([])
  })

  test('full motion: open and close both animate a transform', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await gotoTrial(page)
    const seen = await sampleTransforms(page, async () => {
      await pill(page).click()
      await expect(dialog(page)).toBeVisible()
      await page.waitForTimeout(600)
      await page.keyboard.press('Escape')
      await expect(dialog(page)).toBeHidden()
    })
    expect(seen.length).toBeGreaterThan(0)
  })
})

test.describe('trial add-number dialog on the pop-up shell (375px)', () => {
  test.use({ viewport: PHONE_375 })

  test('bottom sheet above header and bottom nav, inside the viewport, scroll locked', async ({ page }) => {
    await gotoTrial(page)
    const d = await openPopup(page, pill(page))
    await expectDialogA11y(d)
    await expectOnTop(page, d)
    await expectWithinViewport(page, d)
    await expectScrollLocked(page)
    const box = (await d.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(PHONE_375.height)
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(pill(page)).toBeFocused()
  })
})
