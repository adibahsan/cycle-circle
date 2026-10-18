import { test, expect } from '@playwright/test'
import { gotoQuiet, PHONE_375, DESKTOP } from '../guards/helpers'

const grid = (page: import('@playwright/test').Page) => page.getByRole('grid')
const day = (page: import('@playwright/test').Page, name: RegExp) => grid(page).getByRole('button', { name })

test.describe('on a phone', () => {
  // A real phone: touch, no hover. Hover-only affordances (the "+" on unlogged days) must not swallow the tap.
  test.use({ viewport: PHONE_375, hasTouch: true, isMobile: true })

  test('selecting a day on a phone brings its detail card into view', async ({ page }) => {
    await gotoQuiet(page, '/calendar?month=2026-10')
    await day(page, /^Thursday, October 15, 2026\b/).tap()
    const detail = page.getByRole('heading', { level: 3 }).first()
    await expect(detail).toBeVisible()
    await expect(detail).toBeInViewport({ ratio: 1 })
  })

  test('every day cell is at least 44px at 375px', async ({ page }) => {
    await gotoQuiet(page, '/calendar?month=2026-10')
    const cells = grid(page).getByRole('gridcell')
    const n = await cells.count()
    expect(n).toBeGreaterThanOrEqual(28)
    for (let i = 0; i < n; i++) {
      const box = await cells.nth(i).boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('accessible days', () => {
  test.use({ viewport: DESKTOP })

  test('each day names its full date and states; today is aria-current', async ({ page }) => {
    await gotoQuiet(page, '/calendar')
    await expect(grid(page)).toBeVisible()
    const today = grid(page).locator('[aria-current="date"]')
    await expect(today).toHaveCount(1)
    await expect(today).toHaveAccessibleName(/, \d{4}\b.*\bToday$/)
    await gotoQuiet(page, '/calendar?month=2026-10')
    const names = await grid(page)
      .getByRole('button')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
      .then((all) => all.filter((n) => !n.startsWith('Add log for'))) // the hover-only "+" shortcut
    for (const name of names) expect(name).toMatch(/^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}, \d{4}/)
    // The seed persona has cycle data: coloured days also say their state in words.
    expect(names.some((n) => /, (Period|Predicted period|Fertile|Ovulation)\b/.test(n))).toBe(true)
  })

  test('arrow keys move focus within the grid; only one day is tabbable', async ({ page }) => {
    await gotoQuiet(page, '/calendar?month=2026-10')
    await expect(grid(page).locator('button[tabindex="0"]')).toHaveCount(1)

    await day(page, /^Thursday, October 15, 2026\b/).focus()
    await page.keyboard.press('ArrowRight')
    await expect(day(page, /^Friday, October 16, 2026\b/)).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(day(page, /^Friday, October 23, 2026\b/)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(day(page, /^Sunday, October 18, 2026\b/)).toBeFocused()
    await page.keyboard.press('End')
    await expect(day(page, /^Saturday, October 24, 2026\b/)).toBeFocused()
    await expect(grid(page).locator('button[tabindex="0"]')).toHaveCount(1)
  })

  test('PageDown changes month and announces it', async ({ page }) => {
    await gotoQuiet(page, '/calendar?month=2026-10')
    await day(page, /^Thursday, October 15, 2026\b/).focus()
    await page.keyboard.press('PageDown')
    await expect(page).toHaveURL(/month=2026-11/)
    await expect(page.locator('[aria-live="polite"]', { hasText: 'November 2026' })).toHaveCount(1)
    await expect(day(page, /^Sunday, November 15, 2026\b/)).toBeFocused()
  })
})

test.describe('in a UTC+6 browser', () => {
  test.use({ viewport: DESKTOP, timezoneId: 'Asia/Dhaka' })

  test('editing a period opens the form on the tapped date', async ({ page }) => {
    await gotoQuiet(page, '/calendar')
    const row = page.locator('button[aria-label^="Edit period log starting"]:visible').first()
    const label = (await row.getAttribute('aria-label'))!
    const shown = label.replace('Edit period log starting ', '') // e.g. "Oct 5"
    await row.click()
    const start = await page.locator('#period-start-date').inputValue() // YYYY-MM-DD
    const [y, m, d] = start.split('-').map(Number)
    const formDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(y, m - 1, d)),
    )
    expect(formDay).toBe(shown)
  })
})
