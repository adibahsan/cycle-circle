/**
 * Guard: desktop pages fit one screen with components at their own size (never stretched to the viewport),
 * columns that should end level do, and the calendar and symptoms pages share one day grid.
 * Run: pnpm --filter @vesta/web e2e e2e/tests/card-rows.spec.ts
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { gotoQuiet } from '../guards/helpers'

const WIDE = { width: 1920, height: 969 }
const LAPTOP = { width: 1366, height: 657 }

async function bottoms(locators: Locator[]): Promise<number[]> {
  return Promise.all(locators.map(async (l) => {
    const box = (await l.boundingBox())!
    return Math.round(box.y + box.height)
  }))
}

function expectLevel(values: number[]) {
  expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2)
}

const day15 = (page: Page) => page.getByRole('grid').getByRole('button', { name: / 15, \d{4}/ }).first()

test.describe('wide screen (1920)', () => {
  test.use({ viewport: WIDE })

  test('symptoms shows every category at once', async ({ page }) => {
    await gotoQuiet(page, '/symptoms')
    await expect(page.getByRole('tablist')).toBeHidden()
    for (const name of ['Physical', 'Mood', 'Discharge', 'Lifestyle']) {
      await expect(page.getByRole('group', { name, exact: true })).toBeVisible()
    }
  })

  test('calendar and symptoms share the day grid; days keep a sane size', async ({ page }) => {
    for (const [route, maxHeight] of [['/calendar?month=2026-10', 96], ['/symptoms?date=2026-10-18', 64]] as const) {
      await gotoQuiet(page, route)
      const grid = page.getByRole('grid')
      await expect(grid.getByRole('gridcell')).toHaveCount(35)
      await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1)
      const box = (await day15(page).boundingBox())!
      expect(box.height, route).toBeLessThanOrEqual(maxHeight)
    }
  })
})

test.describe('laptop (1366)', () => {
  test.use({ viewport: LAPTOP })

  test('settings columns end level', async ({ page }) => {
    await gotoQuiet(page, '/settings')
    const cards = ['Notifications', 'Account', 'About'].map((h) =>
      page.getByRole('heading', { name: h, exact: true }).locator('xpath=following::div[contains(@class,"rounded-panel")][1]'),
    )
    expectLevel(await bottoms(cards))
  })
})

for (const viewport of [WIDE, LAPTOP]) {
  test.describe(`one screen at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })
    for (const route of ['/calendar', '/symptoms', '/insights', '/settings', '/subscription', '/feedback', '/content', '/profiles']) {
      test(`${route} fits without scrolling`, async ({ page }) => {
        await gotoQuiet(page, route)
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height + 1)
      })
    }
  })
}
