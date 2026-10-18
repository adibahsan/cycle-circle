import { test, expect, type Locator, type Page } from '@playwright/test'
import { gotoQuiet, dialog, DESKTOP, PHONE_375 } from '../guards/helpers'

// #73: the shell in the pastel look. The active nav item is filled with the goal accent and its ink passes 4.5:1.

/** Switch theme, then wait out the nav's colour transitions so we measure the settled pair, not a mid-fade blend. */
async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate(async (t) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
  }, theme)
}

/** Contrast of `ink`'s text colour against the nearest ancestor-or-self with an opaque background. */
async function inkContrast(ink: Locator): Promise<number> {
  return ink.evaluate((el) => {
    const parse = (c: string) => {
      const n = (c.match(/[\d.]+/g) ?? []).map(Number)
      const rgb = c.startsWith('color(') ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3)
      const alpha = n.length > 3 ? n[3] : 1
      return { rgb, alpha }
    }
    let bgEl: Element | null = el
    let bg = parse(getComputedStyle(el).backgroundColor)
    while (bgEl && bg.alpha < 1) {
      bgEl = bgEl.parentElement
      if (bgEl) bg = parse(getComputedStyle(bgEl).backgroundColor)
    }
    const fg = parse(getComputedStyle(el).color).rgb
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const [a, b] = [lum(fg), lum(bg.rgb)].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  })
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`shell look (desktop, ${theme})`, () => {
    test.use({ viewport: DESKTOP })

    test('the active sidebar item is the goal accent with 4.5:1 text', async ({ page }, info) => {
      await gotoQuiet(page, '/calendar')
      await setTheme(page, theme)
      const sidebar = page.locator('aside')
      const active = sidebar.locator('[aria-current="page"]')
      await expect(active).toHaveCount(1)
      await expect(active).toHaveAttribute('href', '/calendar')
      expect(await inkContrast(active)).toBeGreaterThanOrEqual(4.5)
      await info.attach(`shell-desktop-${theme}`, { body: await page.screenshot(), contentType: 'image/png' })
    })
  })

  test.describe(`shell look (phone, ${theme})`, () => {
    test.use({ viewport: PHONE_375 })

    test('the active bottom-nav pill is the goal accent with 4.5:1 ink', async ({ page }, info) => {
      await gotoQuiet(page, '/calendar')
      await setTheme(page, theme)
      const active = page.locator('nav[data-bottom-nav] [aria-current="page"]')
      await expect(active).toHaveCount(1)
      // The icon pill carries the goal accent; its ink is the icon colour.
      const pill = active.locator('svg').first().locator('xpath=..')
      expect(await inkContrast(pill)).toBeGreaterThanOrEqual(4.5)
      // The label under it stays body text on the card surface.
      expect(await inkContrast(active.locator('span.text-\\[11px\\]'))).toBeGreaterThanOrEqual(4.5)
      await info.attach(`shell-phone-${theme}`, { body: await page.screenshot(), contentType: 'image/png' })
    })

    test('the More sheet shows the active destination filled and the rest on tinted badges', async ({ page }, info) => {
      await gotoQuiet(page, '/settings')
      await setTheme(page, theme)
      await page.locator('nav[data-bottom-nav] button').click()
      const d = dialog(page)
      await expect(d).toBeVisible()
      const active = d.locator('a[aria-current="page"]')
      await expect(active).toHaveAttribute('href', '/settings')
      expect(await inkContrast(active)).toBeGreaterThanOrEqual(4.5)
      for (const href of ['/content', '/profiles', '/subscription', '/feedback'])
        expect(await inkContrast(d.locator(`a[href="${href}"]`)), href).toBeGreaterThanOrEqual(4.5)
      await info.attach(`more-sheet-${theme}`, { body: await page.screenshot(), contentType: 'image/png' })
    })
  })
}
