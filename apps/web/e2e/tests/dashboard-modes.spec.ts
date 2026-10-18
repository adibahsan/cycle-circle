/**
 * Guard for ticket #76 (dashboard modes and first run).
 * Run: pnpm --filter @vesta/web e2e -- e2e/tests/dashboard-modes.spec.ts
 * Read-only: uses the pregnant / menopause / firstRun personas (e2e/support/ensure-persona.ts) and saves nothing.
 */
import { test, expect, type Page } from '@playwright/test'
import { statePath } from '../support/auth'
import { collectTexts, latinOffenders } from '../support/latin-scan'
import { DESKTOP, PHONE_375, dialog, gotoQuiet } from '../guards/helpers'

const main = (page: Page) => page.locator('main')

/** Cycle predictions and phases that pregnancy and menopause must not show. */
const PREDICTION_WORDS = /fertile|ovulation|next period|period due|days? late|follicular|luteal|menstrual phase/i

async function expectNoCycleBlocks(page: Page) {
  await expect(page.getByTestId('hero-stats')).toHaveCount(0)
  await expect(page.getByTestId('stat-fertile')).toHaveCount(0)
  await expect(page.getByTestId('stat-next-period')).toHaveCount(0)
  await expect(page.getByTestId('cycle-journey')).toHaveCount(0)
  await expect(main(page).getByRole('img', { name: /cycle day/i })).toHaveCount(0)
  expect(await main(page).innerText()).not.toMatch(PREDICTION_WORDS)
}

for (const [label, viewport] of [['desktop', DESKTOP], ['375x667', PHONE_375]] as const) {
  test.describe(`dashboard modes (${label})`, () => {
    test.use({ viewport })

    test.describe('pregnancy', () => {
      test.use({ storageState: statePath('pregnant') })

      test('coming-soon hero, no phases, fertile stat or predictions; toolkit stays', async ({ page }) => {
        await gotoQuiet(page, '/dashboard')
        const hero = page.getByTestId('hero-pregnancy')
        await expect(hero).toBeVisible({ timeout: 15_000 })
        await expect(hero.getByRole('heading', { name: 'Pregnancy tracking is coming soon' })).toBeVisible()
        await expect(hero.getByRole('button', { name: /log symptoms/i })).toBeVisible()
        await expectNoCycleBlocks(page)
        await expect(page.getByTestId('toolkit-card')).toHaveCount(6)
        await expect(page.getByRole('link', { name: 'See all articles' })).toHaveAttribute('href', '/content')
      })
    })

    test.describe('menopause', () => {
      test.use({ storageState: statePath('menopause') })

      test('hero shows days since the last period, no predictions', async ({ page }) => {
        await gotoQuiet(page, '/dashboard')
        const hero = page.getByTestId('hero-menopause')
        await expect(hero).toBeVisible({ timeout: 15_000 })
        await expect(page.getByTestId('stat-days-since')).toContainText(/\d+ days? since your last period/)
        await expectNoCycleBlocks(page)
      })

      test('symptom pattern: most logged over the last 90 days, no phases (story 18, #66 S1)', async ({ page }) => {
        await gotoQuiet(page, '/dashboard')
        const card = page.getByTestId('symptom-pattern')
        await expect(card.getByRole('heading', { name: 'Your symptom pattern' })).toBeVisible({ timeout: 15_000 })
        await expect(card).toContainText('Most logged in the last 90 days')
        const items = card.getByTestId('phase-pattern-list').locator('li')
        await expect(items).toHaveCount(2)
        await expect(items.nth(0)).toContainText('Hot Flashes')
        await expect(items.nth(0)).toContainText('Logged 2 times')
        await expect(items.nth(1)).toContainText('Poor Sleep')
        await expect(page.getByTestId('phase-pattern')).toHaveCount(0)
      })
    })

    test.describe('no period logged', () => {
      test.use({ storageState: statePath('firstRun') })

      test('hero asks for the last period with a single Log period button', async ({ page }) => {
        await gotoQuiet(page, '/dashboard')
        const hero = page.getByTestId('hero-first-period')
        await expect(hero).toBeVisible({ timeout: 15_000 })
        await expect(hero.getByRole('heading', { name: 'When did your last period start?' })).toBeVisible()
        await expect(hero.locator('a, button')).toHaveCount(1)
        const log = hero.getByRole('button', { name: /log period/i })
        await expect(page.getByTestId('hero-stats')).toHaveCount(0)
        await expect(page.getByTestId('stat-fertile')).toHaveCount(0)
        // Story 19: the hero's button is the page's only Log period button (no toolkit duplicate).
        await expect(main(page).getByRole('button', { name: /log period/i })).toHaveCount(1)
        await expect(page.getByTestId('toolkit-card')).toHaveCount(5)
        // The button opens the period log (closed again without saving).
        await log.click()
        await expect(dialog(page)).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(dialog(page)).toBeHidden()
      })

      test('stepper and ring show a 28-day example, labelled and announced as one', async ({ page }) => {
        await gotoQuiet(page, '/dashboard')
        const journey = page.getByTestId('cycle-journey')
        await expect(journey).toHaveAttribute('data-example', 'true', { timeout: 15_000 })
        // Visible label on both cards.
        await expect(page.getByTestId('example-note')).toHaveCount(2)
        for (const note of await page.getByTestId('example-note').all()) await expect(note).toContainText('Example')
        // Announced: the ring's name and both sections' descriptions say "example".
        await expect(main(page).getByRole('img', { name: /^Example: cycle day \d+ of 28, not your data$/ })).toBeVisible()
        for (const id of ['journey-title', 'progress-title']) {
          const section = page.locator(`section[aria-labelledby="${id}"]`)
          await expect(section).toHaveAccessibleDescription(/example/i)
        }
        // No real cycle position on an example.
        await expect(journey.locator('[aria-current="step"]')).toHaveCount(0)
        const days = await journey.locator('li').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-days'))))
        expect(days.reduce((a, b) => a + b, 0)).toBe(28)
      })
    })
  })
}

/** Persisted store read by the app on load: language is the only thing set. */
async function useBengali(page: Page) {
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem('vesta-store')
      const store = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      store.state = { ...store.state, language: 'bn' }
      localStorage.setItem('vesta-store', JSON.stringify(store))
    } catch {}
  })
}

async function profileNames(page: Page): Promise<string[]> {
  const res = await page.request.get('/api/profiles')
  if (!res.ok()) return []
  const body = (await res.json()) as { profiles?: { name?: string }[] }
  return (body.profiles ?? []).map((p) => p.name ?? '').filter(Boolean)
}

for (const [persona, heroId] of [
  ['pregnant', 'hero-pregnancy'],
  ['menopause', 'hero-menopause'],
  ['firstRun', 'hero-first-period'],
] as const) {
  test.describe(`bengali dashboard: ${persona}`, () => {
    test.use({ viewport: PHONE_375, storageState: statePath(persona) })

    test('no English in any mode', async ({ page }) => {
      await useBengali(page)
      await gotoQuiet(page, '/dashboard')
      await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
      await expect(page.getByTestId(heroId)).toBeVisible({ timeout: 15_000 })
      const bad = latinOffenders(await collectTexts(page, 'body'), await profileNames(page))
      expect(bad.map((b) => `${b.where}: ${JSON.stringify(b.value)}`)).toEqual([])
    })
  })
}
