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
    const wide = new Set(['/dashboard', '/calendar'])
    for (const route of ROUTES) {
      await gotoQuiet(page, route)
      const w = await page.locator('main h1').evaluate((el) => {
        const container = el.closest('header')!.parentElement as HTMLElement
        return container.getBoundingClientRect().width
      })
      expect(w, `${route} container width`).toBeLessThanOrEqual(wide.has(route) ? 1024 : 896)
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
