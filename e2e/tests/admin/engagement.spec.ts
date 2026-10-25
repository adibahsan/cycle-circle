import { randomBytes } from 'node:crypto'
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'
import { toDbPhone } from '../../support/users'

async function refreshEngagement(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: 'Refresh data' })
  await btn.click()
  await expect(btn).toBeEnabled({ timeout: 15_000 })
}

function chartCard(page: Page, title: string) {
  return page
    .getByRole('heading', { name: title, exact: true })
    .locator('xpath=ancestor::div[.//summary[contains(., "View data as table")]][1]')
}

async function openChartTable(page: Page, title: string) {
  const card = chartCard(page, title)
  const table = card.getByRole('table', { name: title })
  if (!(await table.isVisible().catch(() => false))) {
    await card.getByText('View data as table').click()
  }
  await expect(table).toBeVisible({ timeout: 10_000 })
  return table
}

function utcDayKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Read the numeric cell for a row named `x` in an opened chart table. */
async function readTableRowNumber(table: Locator, rowName: string): Promise<number> {
  const row = table.getByRole('row', { name: new RegExp(`^${rowName}\\b`) })
  await expect(row).toBeVisible()
  const raw = ((await row.getByRole('cell').first().textContent()) ?? '').trim()
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) throw new Error(`Expected integer in row "${rowName}", got "${raw}"`)
  return n
}

test.describe('Admin engagement', () => {
  test('daily loggers, logging rate, and streaks reflect run logging; 7d range includes/excludes Bangladesh-day edges', async ({
    browser,
    newUser,
    days,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const runId = randomBytes(3).toString('hex')
    const throwaway = await newUser()
    const db = e2eDb()
    const user = await db.user.findUniqueOrThrow({ where: { phone: toDbPhone(throwaway.phone) } })
    const profile = await db.profile.create({
      data: {
        userId: user.id,
        name: `E2E 130 eng ${runId}`,
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
      },
    })

    // 7d rolling window edges via Bangladesh days (orchestrator: just inside / just outside).
    // daysAgo(3) is inside now−7d but not "today/yesterday" for streak math; daysAgo(8) is outside.
    const insideAt = days.startOf(days.daysAgo(3))
    const outsideAt = days.startOf(days.daysAgo(8))
    const insideKey = utcDayKey(insideAt)
    const outsideKey = utcDayKey(outsideAt)

    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    try {
      const { page } = admin

      await page.goto('/engagement?range=7d')
      await expect(page.getByRole('heading', { name: 'Engagement' })).toBeVisible()
      await expect(
        page.getByRole('group', { name: 'Date range' }).getByRole('button', { name: '7d' }),
      ).toHaveAttribute('aria-pressed', 'true')

      // Snapshot the 3-6 streak bucket before this profile has an active streak.
      let beforeStreak36 = -1
      await expect
        .poll(
          async () => {
            await refreshEngagement(page)
            try {
              const table = await openChartTable(page, 'Logging Streak Distribution')
              beforeStreak36 = await readTableRowNumber(table, '3-6')
              return beforeStreak36
            } catch {
              return -1
            }
          },
          { timeout: 20_000 },
        )
        .toBeGreaterThanOrEqual(0)

      await db.symptomLog.create({
        data: {
          profileId: profile.id,
          date: insideAt,
          category: 'PHYSICAL',
          symptomId: `e2e130eng_in_${runId}`,
          value: 'mild',
        },
      })
      await db.symptomLog.create({
        data: {
          profileId: profile.id,
          date: outsideAt,
          category: 'PHYSICAL',
          symptomId: `e2e130eng_out_${runId}`,
          value: 'mild',
        },
      })

      // Daily Active Loggers: inside day ≥ 1 profile; outside day absent from 7d series.
      await expect
        .poll(
          async () => {
            await refreshEngagement(page)
            const table = await openChartTable(page, 'Daily Active Loggers')
            if ((await table.getByRole('row', { name: new RegExp(`^${outsideKey}\\b`) }).count()) !== 0) {
              return -2
            }
            const insideRow = table.getByRole('row', { name: new RegExp(`^${insideKey}\\b`) })
            if ((await insideRow.count()) === 0) return -1
            const raw = ((await insideRow.getByRole('cell').first().textContent()) ?? '').trim()
            const n = Number.parseInt(raw, 10)
            return Number.isFinite(n) ? n : -1
          },
          { timeout: 25_000 },
        )
        .toBeGreaterThanOrEqual(1)

      const loggersTable = await openChartTable(page, 'Daily Active Loggers')
      await expect(loggersTable.getByRole('row', { name: new RegExp(`^${outsideKey}\\b`) })).toHaveCount(0)

      // Symptom Logging Rate: same inside day shows a positive % (at least our profile logged).
      await expect
        .poll(
          async () => {
            await refreshEngagement(page)
            const table = await openChartTable(page, 'Symptom Logging Rate')
            const row = table.getByRole('row', { name: new RegExp(`^${insideKey}\\b`) })
            if ((await row.count()) === 0) return -1
            const raw = ((await row.getByRole('cell').first().textContent()) ?? '').trim()
            const n = Number.parseInt(raw, 10)
            return Number.isFinite(n) ? n : -1
          },
          { timeout: 25_000 },
        )
        .toBeGreaterThan(0)

      // Consecutive Bangladesh days → streak length 3 → bucket 3-6 (0..2 covers UTC/Dhaka "today").
      for (const n of [0, 1, 2]) {
        await db.symptomLog.create({
          data: {
            profileId: profile.id,
            date: days.startOf(days.daysAgo(n)),
            category: 'MOOD',
            symptomId: `e2e130eng_streak_${runId}_${n}`,
            value: 'x',
          },
        })
      }

      await expect
        .poll(
          async () => {
            await refreshEngagement(page)
            const table = await openChartTable(page, 'Logging Streak Distribution')
            return readTableRowNumber(table, '3-6')
          },
          { timeout: 25_000 },
        )
        .toBeGreaterThanOrEqual(beforeStreak36 + 1)

      // Date range control changes the URL and reloads series.
      const rangeGroup = page.getByRole('group', { name: 'Date range' })
      await rangeGroup.getByRole('button', { name: '30d' }).click()
      await expect(page).toHaveURL(/range=30d/)
      await rangeGroup.getByRole('button', { name: '7d' }).click()
      await expect(page).toHaveURL(/range=7d/)
      await expect(rangeGroup.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')

      await refreshEngagement(page)
      const afterToggle = await openChartTable(page, 'Daily Active Loggers')
      await expect(afterToggle.getByRole('row', { name: new RegExp(`^${insideKey}\\b`) })).toBeVisible()
      await expect(afterToggle.getByRole('row', { name: new RegExp(`^${outsideKey}\\b`) })).toHaveCount(0)
    } finally {
      await admin.context.close()
    }
  })
})
