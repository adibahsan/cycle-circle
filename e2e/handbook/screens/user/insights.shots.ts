/**
 * Handbook chapter "Insights" (docs/handbook/chapters/insights.md), ticket #242.
 * Seeded personas are read-only: these shots only look and tap the page's own filters.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { statePath } from '../../../support/personas.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { shot } from '../../support/shot.ts'

const section = (page: import('@playwright/test').Page, id: string) => page.locator(`section[aria-labelledby="${id}"]`)

test.describe('Insights', () => {
  test.describe('Farida (nine periods)', () => {
    test.use({ storageState: statePath('power') })

    test('overview, cycle charts and symptom statistics', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/insights')
      await expect(page.getByRole('heading', { name: 'Cycle Insights' })).toBeVisible()
      await expect(section(page, 'cycle-length-title')).toBeVisible()
      await shot(page, 'in-overview')

      const cycle = section(page, 'cycle-length-title')
      await shot(page, 'in-cycle-charts', { of: cycle })
      await page.getByRole('button', { name: 'Bar', exact: true }).first().click()
      await shot(page, 'in-cycle-charts', { suffix: 'bar', of: cycle })
      await page.getByRole('button', { name: 'Last 3 months' }).click()
      await shot(page, 'in-cycle-charts', { suffix: 'last-3-months', of: cycle })
      await page.getByRole('button', { name: 'All time' }).first().click()

      await shot(page, 'in-symptom-stats', { of: section(page, 'symptom-frequency-title') })
      await page.mouse.move(2, 2)
      await section(page, 'period-regularity-title').evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await shot(page, 'in-symptom-stats', { suffix: 'regularity' })
      await shot(page, 'in-symptom-stats', { suffix: 'fertile-windows', of: section(page, 'fertile-window-title') })
    })
  })

  test.describe('Mitu (one period, no symptoms)', () => {
    test.use({ storageState: statePath('newUser') })

    test('no insights yet', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/insights')
      await expect(page.getByText('No insights yet')).toBeVisible()
      await shot(page, 'in-empty')
    })
  })

  test.describe('Sultana (symptoms but one period)', () => {
    test.use({ storageState: statePath('allGood') })

    test('partial data note', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/insights')
      await expect(page.getByTestId('insights-missing-note')).toBeVisible()
      await page.getByTestId('insights-missing-note').scrollIntoViewIfNeeded()
      await shot(page, 'in-empty', { suffix: 'partial' })
    })
  })
})
