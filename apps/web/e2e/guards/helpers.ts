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
import { applyLoggingMock, applyStatusMock } from '../support/mocks'

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

/** Apply named mocks (see e2e/support/mocks.ts) to /api/auth/status and /api/tracking/logging-status. Call before goto. */
export async function mockApi(page: Page, names: string[]) {
  await page.route('**/api/auth/status', async (route) => {
    const res = await route.fetch()
    await route.fulfill({ response: res, json: applyStatusMock(await res.json(), names) })
  })
  await page.route('**/api/tracking/logging-status', async (route) => {
    const res = await route.fetch()
    await route.fulfill({ response: res, json: applyLoggingMock(await res.json(), names) })
  })
}

/** Press Tab / Shift+Tab `presses` times; focus must stay inside `d` every time. */
export async function expectTabTrap(page: Page, d: Locator, presses = 12) {
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press(key)
      const inside = await d.evaluate((el) => el.contains(document.activeElement))
      expect(inside, `${key} press ${i + 1} moved focus outside the dialog`).toBe(true)
    }
  }
}

/** Page behind a pop-up is locked: html/body overflow hidden and wheel does not scroll the document. */
export async function expectScrollLocked(page: Page) {
  const overflow = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflow,
    body: getComputedStyle(document.body).overflow,
  }))
  expect(overflow.html === 'hidden' || overflow.body === 'hidden', 'html or body should have overflow hidden').toBe(true)
  const before = await page.evaluate(() => window.scrollY)
  await page.mouse.move(5, 5)
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => window.scrollY)).toBe(before)
}

/** Scroll lock released: neither html nor body is overflow hidden. */
export async function expectScrollUnlocked(page: Page) {
  const overflow = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflow,
    body: getComputedStyle(document.body).overflow,
  }))
  expect(overflow.html).not.toBe('hidden')
  expect(overflow.body).not.toBe('hidden')
}

/**
 * The dialog (and its backdrop) paint above all page chrome: the topmost element at the
 * viewport corners and at the dialog centre belongs to a pop-up root.
 */
export async function expectOnTop(page: Page, d: Locator) {
  const box = await d.boundingBox()
  expect(box).not.toBeNull()
  const vw = page.viewportSize()!.width
  const points = [
    { x: 4, y: 4 },
    { x: vw - 4, y: 4 },
    { x: 4, y: page.viewportSize()!.height - 4 },
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  ]
  for (const pt of points) {
    const ok = await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-popup-root]'),
      pt,
    )
    expect(ok, `element at (${Math.round(pt.x)}, ${Math.round(pt.y)}) is not inside a pop-up root`).toBe(true)
  }
}

/** Samples the dialog panel transform every frame while `action` runs; returns every non-'none' value seen. */
export async function sampleTransforms(page: Page, action: () => Promise<void>): Promise<string[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __tx: string[]; __txStop: boolean }
    w.__tx = []
    w.__txStop = false
    const tick = () => {
      document.querySelectorAll('[data-popup-panel]').forEach((el) => {
        const t = getComputedStyle(el).transform
        if (t && t !== 'none') w.__tx.push(t)
      })
      if (!w.__txStop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await action()
  await page.waitForTimeout(500)
  return page.evaluate(() => {
    const w = window as unknown as { __tx: string[]; __txStop: boolean }
    w.__txStop = true
    return w.__tx
  })
}
