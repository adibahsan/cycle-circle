import { test, expect } from '@playwright/test'
import { gotoQuiet, DESKTOP, PHONE_375, expectNoHorizontalOverflow } from '../guards/helpers'

const ROUTES = [
  '/dashboard',
  '/calendar',
  '/symptoms',
  '/insights',
  '/content',
  '/profiles',
  '/settings',
  '/subscription',
  '/feedback',
]

test.describe('page shell (desktop)', () => {
  test.use({ viewport: DESKTOP })

  test('every page has exactly one h1 and a shared left edge', async ({ page }) => {
    const lefts: Record<string, number> = {}
    for (const route of ROUTES) {
      await gotoQuiet(page, route)
      await expect(page.locator('h1'), `${route} h1 count`).toHaveCount(1)
      const box = await page.locator('main h1').boundingBox()
      expect(box, `${route} h1 box`).not.toBeNull()
      lefts[route] = Math.round(box!.x)
    }
    const values = Object.values(lefts)
    expect(Math.max(...values) - Math.min(...values), JSON.stringify(lefts)).toBeLessThanOrEqual(1)
  })

  test('h1 uses the shared title scale', async ({ page }) => {
    for (const route of ROUTES) {
      await gotoQuiet(page, route)
      const size = await page.locator('main h1').evaluate((el) => getComputedStyle(el).fontSize)
      expect(size, `${route} h1 size`).toBe('30px')
    }
  })

  test('container width follows the scale', async ({ page }) => {
    for (const route of ROUTES) {
      await gotoQuiet(page, route)
      const w = await page.locator('main h1').evaluate((el) => {
        const container = el.closest('header')!.parentElement as HTMLElement
        return container.getBoundingClientRect().width
      })
      expect(w, `${route} container width`).toBeLessThanOrEqual(1024)
    }
  })

  test('every page fills a 1920px screen (no empty band on the right)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    for (const route of ROUTES) {
      await gotoQuiet(page, route)
      const right = await page.locator('main h1').evaluate((el) => {
        return (el.closest('header')!.parentElement as HTMLElement).getBoundingClientRect().right
      })
      expect(1920 - right, `${route} right gutter`).toBeLessThanOrEqual(96)
    }
  })

  test('two-column pages keep columns >= 320px at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    for (const route of ['/profiles', '/settings', '/subscription', '/feedback', '/calendar', '/symptoms']) {
      await gotoQuiet(page, route)
      await expectNoHorizontalOverflow(page)
    }
  })

  test('not-found page uses the shared shell', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')
    await expect(page.locator('h1')).toHaveCount(1)
  })
})

test.describe('page shell (375px)', () => {
  test.use({ viewport: PHONE_375 })

  test('every page has exactly one h1', async ({ page }) => {
    for (const route of ROUTES) {
      await gotoQuiet(page, route)
      await expect(page.locator('h1'), `${route} h1 count`).toHaveCount(1)
    }
  })
})

test.describe('shell basics (#71)', () => {
  test.use({ viewport: DESKTOP })

  test('first Tab reaches a visible skip link that moves focus to main content', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /skip to main content|মূল কনটেন্টে যান/i })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
  })

  test('settings inputs have accessible names and controls are at least 44px tall', async ({ page }) => {
    await gotoQuiet(page, '/settings')
    const main = page.locator('main')
    // Open the inline contact editors so their inputs are in the DOM.
    for (const b of await main.getByRole('button', { name: /add|change|যোগ|পরিবর্তন/i }).all()) {
      if (await b.isVisible()) await b.click().catch(() => {})
    }
    const inputs = main.locator('input:visible')
    for (const input of await inputs.all()) {
      const name = await input.evaluate((el) => {
        const i = el as HTMLInputElement
        return (i.labels?.[0]?.textContent ?? i.getAttribute('aria-label') ?? '').trim()
      })
      expect(name, `input ${await input.evaluate((el) => el.outerHTML.slice(0, 80))} has a name`).not.toBe('')
    }
    const controls = main.locator('input:visible, button:visible, [role="switch"]:visible, select:visible')
    for (const c of await controls.all()) {
      const h = await c.evaluate((el) => {
        const target = (el as HTMLInputElement).labels?.[0] ?? el
        return Math.max(el.getBoundingClientRect().height, target.getBoundingClientRect().height)
      })
      expect(h, `${await c.evaluate((el) => el.outerHTML.slice(0, 80))} tap height`).toBeGreaterThanOrEqual(44)
    }
  })

  test('the dashboard stops moving once loaded', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    await page.waitForTimeout(2000)
    const result = await page.evaluate(async () => {
      const infinite = document
        .getAnimations()
        .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)
        .map((a) => (a.effect as KeyframeEffect | null)?.target?.outerHTML.slice(0, 80))
      let styleWrites = 0
      const obs = new MutationObserver((records) => {
        styleWrites += records.length
      })
      obs.observe(document.querySelector('main')!, { attributes: true, attributeFilter: ['style'], subtree: true })
      await new Promise((r) => setTimeout(r, 1500))
      obs.disconnect()
      return { infinite, styleWrites }
    })
    expect(result.infinite, 'infinite animations').toEqual([])
    expect(result.styleWrites, 'inline style writes while idle').toBe(0)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`the cycle ring number passes 3:1 in ${theme} mode`, async ({ page }) => {
      await gotoQuiet(page, '/dashboard')
      await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme)
      const ring = page.getByRole('img', { name: /cycle day|days late|চক্রের দিন|দিন দেরি/i })
      await expect(ring).toBeVisible()
      const ratio = await ring.evaluate((el) => {
        const num = el.querySelector('[data-ring-number]') as HTMLElement
        const probe = document.createElement('div')
        probe.style.color = 'var(--color-bg-card)'
        el.appendChild(probe)
        // rgb(r, g, b) or color(srgb r g b) when the token is a color-mix().
        const parse = (c: string) => {
          const n = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
          return c.startsWith('color(') ? n.map((v) => v * 255) : n
        }
        const fg = parse(getComputedStyle(num).color)
        const bg = parse(getComputedStyle(probe).color)
        probe.remove()
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const s = v / 255
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
        return (a + 0.05) / (b + 0.05)
      })
      expect(ratio).toBeGreaterThanOrEqual(3)
    })
  }
})
