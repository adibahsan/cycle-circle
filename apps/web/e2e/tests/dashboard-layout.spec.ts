/**
 * Guard for ticket #74 (standard-mode dashboard in the new look).
 * Run: pnpm --filter @vesta/web e2e -- e2e/tests/dashboard-layout.spec.ts
 * Read-only: nothing here saves data (the seed database is shared with other guards).
 * The late checks use the `late` persona (exactly 7 days late; e2e/support/ensure-persona.ts).
 * The Bengali dashboard is covered by bengali-no-english.spec.ts ("/dashboard").
 */
import { test, expect, type Page } from '@playwright/test'
import { statePath } from '../support/auth'
import { DESKTOP, PHONE_375, gotoQuiet } from '../guards/helpers'

const main = (page: Page) => page.locator('main')
const LATE = /\b\d+\s+days?\s+late\b|\boverdue\b/gi

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

    test('hero shows three stats', async ({ page }) => {
      await expect(page.getByTestId('hero-stats').locator('li')).toHaveCount(3)
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

    test('last period and predicted windows show real dates (#66 S6)', async ({ page }) => {
      const last = page.getByTestId('last-period')
      await expect(last.getByRole('heading', { name: 'Last period' })).toBeVisible()
      await expect(last).toContainText(/[A-Z][a-z]{2} \d{1,2}/)
      const windows = page.getByTestId('predicted-windows')
      await expect(windows.getByRole('heading', { name: 'Predicted windows' })).toBeVisible()
      await expect(windows.locator('dt')).toHaveText(['Fertile window', 'Ovulation day'])
      await expect(windows.locator('dd').first()).toContainText(/\d{1,2} – [A-Z][a-z]{2} \d{1,2}/)
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

for (const [label, viewport] of [['desktop', DESKTOP], ['375x667', PHONE_375]] as const) {
  test.describe(`late dashboard (${label})`, () => {
    test.use({ viewport, storageState: statePath('late') })

    test('the late day count appears exactly once, in the next-period stat (#74, #66 S3)', async ({ page }) => {
      await gotoQuiet(page, '/dashboard')
      await expect(page.getByTestId('hero-stats')).toBeVisible({ timeout: 15_000 })
      const late = (await mainText(page)).match(LATE) ?? []
      expect(late, `late mentions: ${JSON.stringify(late)}`).toEqual(['7 days late'])
      await expect(page.getByTestId('stat-next-period')).toContainText('7 days late')
    })

    test('the ring says the period is expected, without a count (#66 S7)', async ({ page }) => {
      await gotoQuiet(page, '/dashboard')
      const ring = page.locator('section[aria-labelledby="progress-title"]')
      await expect(ring).toContainText('Period expected', { timeout: 15_000 })
      await expect(ring).not.toContainText(/late|due soon/i)
    })
  })
}

test.describe('dashboard layout (1920 wide)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test('wide screens fill with a side rail instead of an empty gutter', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    await expect(page.getByTestId('hero-stats')).toBeVisible({ timeout: 15_000 })
    const hero = (await page.getByTestId('hero-stats').boundingBox())!
    const dates = (await page.getByTestId('cycle-dates').boundingBox())!
    // The dates sit in the rail, to the right of the hero, not below it.
    expect(dates.x).toBeGreaterThan(hero.x + hero.width)
    // No wide empty band on the right: the rail ends within the page padding.
    expect(1920 - (dates.x + dates.width)).toBeLessThanOrEqual(96)
  })
})

// The toolkit is the dashboard's actions: it must sit in the first view on common laptop and desktop screens.
for (const viewport of [
  { width: 1366, height: 657 },
  { width: 1440, height: 789 },
  { width: 1920, height: 969 },
]) {
  test.describe(`dashboard first view (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport })

    test('the whole toolkit is visible without scrolling', async ({ page }) => {
      await gotoQuiet(page, '/dashboard')
      const toolkit = page.locator('section[aria-labelledby="toolkit-title"]')
      await expect(toolkit).toBeVisible({ timeout: 15_000 })
      const box = await toolkit.boundingBox()
      expect(box, 'toolkit box').not.toBeNull()
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    })

    test('the streak card keeps its contents inside', async ({ page }) => {
      await gotoQuiet(page, '/dashboard')
      const badge = page.locator('[aria-atomic="true"][aria-live="polite"]').first()
      await expect(badge).toBeVisible({ timeout: 15_000 })
      const overflow = await badge.evaluate((el) => {
        const row = el.parentElement!
        const card = row.parentElement!.getBoundingClientRect()
        return [...row.querySelectorAll('*')].some((c) => c.getBoundingClientRect().right > card.right + 0.5)
      })
      expect(overflow).toBe(false)
    })
  })
}
