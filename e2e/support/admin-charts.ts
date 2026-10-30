/**
 * Shared admin chart helpers (analytics + engagement specs): the browser-context options
 * for admin sessions, the RefetchButton, and the ChartPanel card / data-table lookups.
 */
import { expect, type Page } from '@playwright/test'

export type AdminBrowserOpts = {
  viewport: { width: number; height: number } | null
  userAgent?: string
  isMobile?: boolean
  hasTouch?: boolean
  deviceScaleFactor?: number
  locale?: string
  timezoneId?: string
}

/** Bust unstable_cache via RefetchButton, then wait for the transition to finish. */
export async function refreshData(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: 'Refresh data' })
  await btn.click()
  await expect(btn).toBeEnabled({ timeout: 15_000 })
}

/**
 * ChartPanel Card root (`rounded-2xl`; the panel has no role or accessible name of its own).
 * Empty panels omit the data-table summary, so do not require it here: openChartTable adds that check.
 */
export function chartCard(page: Page, title: string) {
  // eslint-disable-next-line playwright/no-raw-locators -- ChartPanel card has no role or accessible name; reached via its heading
  return page
    .getByRole('heading', { name: title, exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
}

export async function openChartTable(page: Page, title: string) {
  const card = chartCard(page, title)
  const table = card.getByRole('table', { name: title })
  if (!(await table.isVisible().catch(() => false))) {
    // eslint-disable-next-line playwright/no-raw-locators -- native <summary> disclosure has no role or name hook
    await card.locator('summary', { hasText: 'View data as table' }).click()
  }
  await expect(table).toBeVisible({ timeout: 10_000 })
  return table
}
