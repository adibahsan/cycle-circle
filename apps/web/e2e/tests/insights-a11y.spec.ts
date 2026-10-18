/**
 * Ticket #70: Insights charts are accessible, Bengali-correct and lazy.
 * Run: pnpm --filter @vesta/web e2e -- e2e/tests/insights-a11y.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import i18n from '@vesta/shared/utils/i18n'
import { statePath } from '../support/auth'
import { gotoQuiet, DESKTOP } from '../guards/helpers'

const en = i18n.getFixedT('en')
const bn = i18n.getFixedT('bn')

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

test.use({ viewport: DESKTOP })

test('each chart exposes a data table to assistive tech', async ({ page }) => {
  await gotoQuiet(page, '/insights')
  const tables = page.getByRole('table')
  const charts = page.locator('.recharts-wrapper')
  await expect(charts.first()).toBeVisible()
  // One table per rendered chart, plus the fertile-window table when that list shows.
  expect(await tables.count()).toBeGreaterThanOrEqual(await charts.count())
  for (const caption of await tables.locator('caption').allTextContents()) {
    expect(caption).toContain(en('insights.dataTable'))
  }
})

test('chart tooltips are reachable by keyboard', async ({ page }) => {
  await gotoQuiet(page, '/insights')
  const surface = page.locator('.recharts-wrapper svg[tabindex="0"]').first()
  await expect(surface).toBeVisible()
  await surface.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.recharts-tooltip-wrapper').first()).toBeVisible()
})

test('symptom chart states that the date range does not apply', async ({ page }) => {
  await gotoQuiet(page, '/insights')
  const heading = page.getByRole('heading', { name: en('insights.symptomFrequency') })
  test.skip((await heading.count()) === 0, 'seed persona has no symptom data')
  await expect(page.getByText(en('insights.symptomAllTime'))).toBeVisible()
})

test('Bengali: summaries and tables use Bengali digits', async ({ page }) => {
  await useBengali(page)
  await gotoQuiet(page, '/insights')
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
  const tableText = (await page.getByRole('table').allTextContents()).join(' ')
  expect(tableText).toMatch(/[০-৯]/)
  expect(tableText).not.toMatch(/[0-9]/)
  const ticks = (await page.locator('.recharts-cartesian-axis-tick-value').allTextContents()).join(' ')
  expect(ticks).not.toMatch(/[0-9]/)
  await expect(page.getByText(bn('insights.dataTable'), { exact: false }).first()).toBeAttached()
})

test.describe('empty account', () => {
  test.use({ storageState: statePath('fresh') })
  test('the empty Insights page does not download the chart library', async ({ page }) => {
    const bodies: Promise<string>[] = []
    page.on('response', (res) => {
      if (res.request().resourceType() === 'script') bodies.push(res.text().catch(() => ''))
    })
    await gotoQuiet(page, '/insights')
    await expect(page.getByTestId('insights-empty')).toHaveCount(1)
    const scripts = await Promise.all(bodies)
    // "recharts-surface" is a class name only the chart library's own code emits.
    expect(scripts.some((s) => s.includes('recharts-surface'))).toBe(false)
  })
})
