import { test, expect, type Page } from '@playwright/test'
import { gotoQuiet, dialog, PHONE_375, PHONE_390, expectNoHorizontalOverflow, expectDialogA11y } from '../guards/helpers'

const ROUTES = ['/dashboard', '/calendar', '/symptoms', '/insights', '/content', '/profiles', '/settings', '/subscription', '/feedback']

for (const vp of [PHONE_375, PHONE_390]) {
  test.describe(`phone shell (${vp.width}px)`, () => {
    test.use({ viewport: vp })

    test('no signed-in page scrolls sideways', async ({ page }) => {
      for (const route of ROUTES) {
        await gotoQuiet(page, route)
        await expectNoHorizontalOverflow(page)
      }
    })
  })
}

test.describe('phone shell (375px)', () => {
  test.use({ viewport: PHONE_375 })

  async function expectNavLabelsVisible(page: Page) {
    const nav = page.locator('nav[data-bottom-nav]')
    const items = nav.locator('a, button')
    await expect(items).toHaveCount(5)
    for (let i = 0; i < 5; i++) {
      const label = items.nth(i).locator('span.text-\\[11px\\]')
      await expect(label).toBeVisible()
      const fits = await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth)
      expect(fits, `label ${i} fits`).toBe(true)
    }
  }

  test('bottom nav has 5 fully visible labels in English and Bengali', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    await expectNavLabelsVisible(page)
    await page.locator('nav[data-bottom-nav] button').click()
    await dialog(page).getByRole('button', { name: /switch language|ভাষা/i }).click()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.locator('nav[data-bottom-nav]')).toContainText('ক্যালেন্ডার')
    await expectNavLabelsVisible(page)
  })

  test('More sheet opens, lists destinations, closes with ESC and restores focus', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    const more = page.locator('nav[data-bottom-nav] button')
    await more.click()
    const d = dialog(page)
    await expect(d).toBeVisible()
    await expectDialogA11y(d)
    for (const href of ['/content', '/profiles', '/subscription', '/feedback', '/settings'])
      await expect(d.locator(`a[href="${href}"]`)).toBeVisible()
    await expect(d.getByRole('button', { name: /light mode|dark mode|লাইট|ডার্ক/i })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(d).toHaveCount(0)
    await expect(more).toBeFocused()
  })

  test('More sheet closes when a destination is chosen', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    await page.locator('nav[data-bottom-nav] button').click()
    await dialog(page).locator('a[href="/settings"]').click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(dialog(page)).toHaveCount(0)
  })

  test('only the current page looks selected', async ({ page }) => {
    await gotoQuiet(page, '/calendar')
    await expect(page.locator('nav[data-bottom-nav] [aria-current="page"]')).toHaveCount(1)
  })

  test('exposes the nav height as a CSS variable and the nav matches it', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    const { varPx, navPx } = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.height = 'var(--bottom-nav-h)'
      document.body.appendChild(probe)
      const varPx = probe.getBoundingClientRect().height
      probe.remove()
      return { varPx, navPx: document.querySelector('nav[data-bottom-nav]')!.getBoundingClientRect().height }
    })
    expect(varPx).toBeGreaterThan(0)
    expect(navPx).toBeGreaterThanOrEqual(varPx)
  })

  test('header holds only the logo mark and one profile chip, no wordmark', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    const header = page.locator('header').first()
    await expect(header).not.toContainText('Cycle Circle')
    await expect(header.locator('a[href="/profiles"]')).toHaveCount(1)
  })

  test('symptoms save bar sits above the bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoQuiet(page, '/symptoms')
    const tile = page.getByRole('group', { name: 'Physical', exact: true }).locator('button[aria-pressed="false"]').first()
    await tile.click()
    const bar = page.getByRole('button', { name: /^Save \d+ changes/ })
    await expect(bar).toBeVisible()
    const navBox = (await page.locator('nav[data-bottom-nav]').boundingBox())!
    // The bar springs in, so poll until it settles.
    await expect
      .poll(async () => {
        const box = (await bar.boundingBox())!
        return Math.round(navBox.y - (box.y + box.height))
      })
      .toBeGreaterThanOrEqual(0)
  })
})
