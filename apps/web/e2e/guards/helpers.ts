/**
 * Guard helpers. A later ticket adds its guard as e2e/tests/<ticket-topic>.spec.ts:
 *
 *   import { test } from '@playwright/test'
 *   import { gotoQuiet, expectNoHorizontalOverflow, expectPopupEscRestoresFocus } from '../guards/helpers'
 *   test('period-log popup', async ({ page }) => {
 *     await gotoQuiet(page, '/dashboard')
 *     await expectPopupEscRestoresFocus(page, page.getByRole('button', { name: 'Log Period' }))
 *   })
 *
 * Phone guards: `test.use({ viewport: PHONE_375 })` at the top of the spec.
 */
import { expect, type Locator, type Page } from '@playwright/test'

export const PHONE_375 = { width: 375, height: 667 }
export const PHONE_390 = { width: 390, height: 844 }
export const DESKTOP = { width: 1366, height: 900 }

/** Suppress auto pop-ups (profile modal, late alert, check-in) so guards start from a clean page. */
export async function suppressAutoPrompts(page: Page) {
  await page.addInitScript(() => {
    try {
      const day = new Date().toISOString().slice(0, 10)
      sessionStorage.setItem('vesta_profile_modal_dismissed', '1')
      localStorage.setItem('vesta_late_alert_seen_' + day, '1')
      const st = JSON.parse(localStorage.getItem('vesta-store') || '{}')
      const id = st.state && st.state.activeProfileId
      if (id) sessionStorage.setItem('vesta_checkin_shown_' + id + '_' + day, '1')
    } catch {}
  })
}

export async function settle(page: Page, ms = 800) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

/** Navigate with auto prompts suppressed and wait for the page to settle. */
export async function gotoQuiet(page: Page, route: string) {
  await suppressAutoPrompts(page)
  await page.goto(route)
  await settle(page)
}

export function dialog(page: Page): Locator {
  return page.locator('[role="dialog"], [role="alertdialog"]').last()
}

/** Click `trigger`, assert a modal dialog appears. Returns the dialog locator. */
export async function openPopup(page: Page, trigger: Locator): Promise<Locator> {
  await trigger.click()
  const d = dialog(page)
  await expect(d).toBeVisible()
  return d
}

/** Open a pop-up from `trigger`, press ESC, assert it closes and focus returns to `trigger`. */
export async function expectPopupEscRestoresFocus(page: Page, trigger: Locator) {
  await openPopup(page, trigger)
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()
  await expect(trigger).toBeFocused()
}

/** Dialog semantics: aria-modal=true and an accessible name. */
export async function expectDialogA11y(d: Locator) {
  await expect(d).toHaveAttribute('aria-modal', 'true')
  const name = (await d.getAttribute('aria-label')) ?? (await d.getAttribute('aria-labelledby'))
  expect(name, 'dialog needs aria-label or aria-labelledby').toBeTruthy()
}

/** No horizontal page scroll at the current viewport (call after `test.use({ viewport })`). */
export async function expectNoHorizontalOverflow(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }))
  expect(sw, `scrollWidth ${sw} exceeds viewport ${cw}`).toBeLessThanOrEqual(cw)
}

/** Every element inside `container` stays within the viewport horizontally (for pop-ups at 375). */
export async function expectWithinViewport(page: Page, container: Locator) {
  const box = await container.boundingBox()
  const vw = page.viewportSize()!.width
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw)
}
