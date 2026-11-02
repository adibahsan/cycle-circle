/**
 * Handbook chapter "Analytics" (docs/handbook/chapters/admin-analytics.md), ticket #246.
 * Churn, Estimated revenue and the Pro count are shown on the Overview page, so those shots are
 * taken there. All data is the seeded demo roster.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'
import { seedAnalyticsHistory } from './analytics-demo.ts'

test.use({ storageState: ADMIN_STATE })

const scrollTo = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('heading', { name, exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }))

test.describe('Admin Analytics', () => {
  test.beforeAll(async ({ db }) => {
    await seedAnalyticsHistory(db)
  })

  test('date ranges', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible()
    await refreshData(page)
    await expect(page.getByRole('heading', { name: 'Cycle Length Distribution' })).toBeVisible()
    await shot(page, 'an-ranges')

    await page.getByRole('button', { name: 'Custom' }).click()
    await expect(page.getByLabel('From')).toBeVisible()
    await page.getByLabel('From').fill('2026-12-31')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('The start day must not be in the future.')).toBeVisible()
    await shot(page, 'an-ranges', { suffix: 'custom-error' })
  })

  test('churn, revenue and Pro count live on the Overview', async ({ page }) => {
    await page.goto('/')
    await refreshData(page)
    await expect(page.getByText('Churn Rate', { exact: true })).toBeVisible()
    await page.getByRole('heading', { name: 'Churn by reason' }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await expect(page.getByRole('row', { name: /BDApps unsubscribe/ })).toBeVisible()
    await shot(page, 'an-churn')

    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.getByText('Estimated Daily Revenue', { exact: true })).toBeVisible()
    await shot(page, 'an-pro-count')

    await scrollTo(page, 'Estimated Revenue (BDT, estimated)')
    await shot(page, 'an-revenue')
  })

  test('prediction accuracy and symptoms by phase', async ({ page }) => {
    await page.goto('/analytics')
    await refreshData(page)
    await expect(page.getByRole('heading', { name: 'Prediction Accuracy by Tier' })).toBeVisible()
    await scrollTo(page, 'Prediction Accuracy (MAE · days)')
    await expect(page.getByText(/Lower MAE = more accurate/)).toBeVisible()
    await shot(page, 'an-prediction-accuracy')

    await scrollTo(page, 'Symptom Logs by Cycle Phase')
    await expect(page.getByText(/Top symptoms per cycle phase/)).toBeVisible()
    await shot(page, 'an-symptoms-phase')
  })
})
