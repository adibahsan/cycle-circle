/**
 * Guard for ticket #74 (standard-mode dashboard in the new look).
 * Run: pnpm --filter @vesta/web e2e -- e2e/tests/dashboard-layout.spec.ts
 * Read-only: nothing here saves data (the seed database is shared with other guards).
 * The Bengali dashboard is covered by bengali-no-english.spec.ts ("/dashboard").
 */
import { test, expect, type Page } from '@playwright/test'
import { DESKTOP, PHONE_375, gotoQuiet } from '../guards/helpers'

const main = (page: Page) => page.locator('main')

async function mainText(page: Page): Promise<string> {
  return main(page).innerText()
}

for (const [label, viewport] of [['desktop', DESKTOP], ['375x667', PHONE_375]] as const) {
  test.describe(`dashboard layout (${label})`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await gotoQuiet(page, '/dashboard')
      await expect(page.getByTestId('hero-stats')).toBeVisible({ timeout: 15_000 })
    })

    test('hero shows three stats, and the late day count at most once', async ({ page }) => {
      await expect(page.getByTestId('hero-stats').locator('li')).toHaveCount(3)
      const text = await mainText(page)
      const late = text.match(/\b\d+\s+days?\s+late\b|\boverdue\b/gi) ?? []
      expect(late.length, `late mentions: ${JSON.stringify(late)}`).toBeLessThanOrEqual(1)
      // When the persona is late, the one mention is in the next-period stat.
      if (late.length === 1) await expect(page.getByTestId('stat-next-period')).toContainText(/late/i)
    })

    test('prediction confidence appears once', async ({ page }) => {
      const text = await mainText(page)
      expect((text.match(/confidence/gi) ?? []).length).toBeLessThanOrEqual(1)
    })

    test('journey stepper: no 0-day phase, one current step, ranges cover the cycle', async ({ page }) => {
      const steps = page.getByTestId('cycle-journey').locator('li')
      const n = await steps.count()
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(4)
      const days = await steps.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-days'))))
      for (const d of days) expect(d).toBeGreaterThan(0)
      await expect(page.getByTestId('cycle-journey').locator('[aria-current="step"]')).toHaveCount(1)
      // "28-day cycle" subtitle: the visible steps add up to it.
      const sub = await page.locator('#journey-title').locator('xpath=..').innerText()
      const length = Number(sub.match(/(\d+)-day cycle/)?.[1])
      expect(days.reduce((a, b) => a + b, 0)).toBe(length)
    })

    test('progress ring has an accessible name', async ({ page }) => {
      await expect(main(page).getByRole('img', { name: /Cycle day \d+ of \d+/ })).toBeVisible()
    })

    test('toolkit: six cards, each with exactly one link or button', async ({ page }) => {
      const cards = page.getByTestId('toolkit-card')
      await expect(cards).toHaveCount(6)
      for (let i = 0; i < 6; i++) {
        await expect(cards.nth(i).locator('a, button')).toHaveCount(1)
      }
    })

    test('read for your phase lists tagged articles or says there are none', async ({ page }) => {
      const list = page.getByTestId('phase-articles')
      const empty = page.getByTestId('phase-articles-empty')
      await expect(list.or(empty)).toBeVisible()
      await expect(page.getByRole('link', { name: 'See all articles' })).toHaveAttribute(
        'href',
        /\/content\?phase=(MENSTRUAL|FOLLICULAR|OVULATION|LUTEAL)$/,
      )
    })

    test('no link inside a button or button inside a link', async ({ page }) => {
      await expect(main(page).locator('a button, button a, a a, button button')).toHaveCount(0)
    })

    test('headings run h1 then h2 without skipping a level', async ({ page }) => {
      const levels = await main(page)
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Number(e.tagName[1])))
      expect(levels[0]).toBe(1)
      expect(levels.filter((l) => l === 1)).toHaveLength(1)
      for (let i = 1; i < levels.length; i++) expect(levels[i], `levels ${levels.join(',')}`).toBeLessThanOrEqual(levels[i - 1] + 1)
    })

    test('no looping animation on the dashboard', async ({ page }) => {
      const infinite = await main(page).evaluate((root) =>
        [root, ...root.querySelectorAll('*')].filter((e) => getComputedStyle(e).animationIterationCount === 'infinite').length,
      )
      expect(infinite).toBe(0)
    })
  })
}
