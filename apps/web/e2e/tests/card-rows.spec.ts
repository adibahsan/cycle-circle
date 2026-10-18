/**
 * Guard: side-by-side cards end on one line, and the calendar and symptoms pages share one day grid.
 * Run: pnpm --filter @vesta/web e2e e2e/tests/card-rows.spec.ts
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { gotoQuiet } from '../guards/helpers'

const WIDE = { width: 1920, height: 969 }
const LAPTOP = { width: 1366, height: 657 }

async function bottoms(locators: Locator[]): Promise<number[]> {
  return Promise.all(locators.map(async (l) => Math.round((await l.boundingBox())!.y + (await l.boundingBox())!.height)))
}

function expectLevel(values: number[]) {
  expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2)
}

async function dayCellHeight(page: Page): Promise<number> {
  return Math.round((await page.getByRole('grid').getByRole('button', { name: / 15, \d{4}/ }).first().boundingBox())!.height)
}

test.describe('wide screen (1920)', () => {
  test.use({ viewport: WIDE })

  test('symptoms shows every category at once, level with the calendar', async ({ page }) => {
    await gotoQuiet(page, '/symptoms')
    await expect(page.getByRole('tablist')).toBeHidden()
    for (const name of ['Physical', 'Mood', 'Discharge', 'Lifestyle']) {
      await expect(page.getByRole('group', { name, exact: true })).toBeVisible()
    }
    // The left column (calendar, then the day's log) ends level with the last category card.
    const leftColumn = page.getByRole('grid').locator('xpath=ancestor::div[contains(@class,"rounded-panel")][1]/..')
    const lastCategory = page.getByRole('group', { name: 'Lifestyle', exact: true }).locator('..')
    expectLevel(await bottoms([leftColumn, lastCategory]))
  })

  test('calendar and symptoms draw days with the same grid', async ({ page }) => {
    const dayClass = () => page.getByRole('grid').getByRole('button', { name: / 15, \d{4}/ }).first().getAttribute('class')
    await gotoQuiet(page, '/calendar?month=2026-10')
    const calendarDay = await dayClass()
    await gotoQuiet(page, '/symptoms?date=2026-10-18')
    expect(await dayClass()).toBe(calendarDay)
    // Never taller than wide, so a stretched calendar keeps sensible day shapes.
    expect(await dayCellHeight(page)).toBeGreaterThanOrEqual(44)
  })
})

test.describe('laptop (1366)', () => {
  test.use({ viewport: LAPTOP })

  test('settings columns end level', async ({ page }) => {
    await gotoQuiet(page, '/settings')
    const headings = ['Notifications', 'Account', 'About']
    const cards = headings.map((h) =>
      page.getByRole('heading', { name: h, exact: true }).locator('xpath=following::div[contains(@class,"rounded-panel")][1]'),
    )
    expectLevel(await bottoms(cards))
  })

  test('calendar side panel ends level with the calendar', async ({ page }) => {
    await gotoQuiet(page, '/calendar')
    const calendar = page.getByRole('grid').locator('xpath=ancestor::div[contains(@class,"rounded-panel")][1]')
    const recent = page.getByRole('heading', { name: 'Recent Periods' }).locator('xpath=ancestor::div[contains(@class,"rounded-panel")][1]')
    expectLevel(await bottoms([calendar, recent]))
  })
})

test.describe('desktop pages fill the screen height', () => {
  for (const viewport of [WIDE, LAPTOP]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport })

      for (const route of ['/calendar', '/symptoms', '/insights', '/settings', '/subscription', '/feedback']) {
        test(`${route} reaches the bottom without scrolling`, async ({ page }) => {
          await gotoQuiet(page, route)
          const { scroll, lowest } = await page.evaluate(() => ({
            scroll: document.documentElement.scrollHeight,
            lowest: Math.max(
              ...[...document.querySelectorAll('main > div > *')].map((el) => el.getBoundingClientRect().bottom),
            ),
          }))
          expect(scroll).toBeLessThanOrEqual(viewport.height + 1)
          expect(viewport.height - lowest).toBeLessThanOrEqual(48)
        })
      }
    })
  }
})
