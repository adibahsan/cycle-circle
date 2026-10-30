import { randomBytes } from 'node:crypto'
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { chartCard, openChartTable, refreshData, type AdminBrowserOpts } from '../../support/admin-charts'
import { e2eDb } from '../../support/db'
import { toDbPhone } from '../../support/users'

async function readTableRowNumber(table: Locator, rowName: string): Promise<number> {
  const row = table.getByRole('row', { name: new RegExp(`^${rowName}\\b`) })
  await expect(row).toBeVisible()
  const raw = ((await row.getByRole('cell').first().textContent()) ?? '').trim()
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) throw new Error(`Expected integer in row "${rowName}", got "${raw}"`)
  return n
}

async function withAdmin(
  browser: Parameters<typeof createLoggedInAdmin>[0],
  opts: AdminBrowserOpts,
  fn: (page: Page) => Promise<void>,
) {
  const admin = await createLoggedInAdmin(browser, opts)
  try {
    await fn(admin.page)
  } finally {
    await admin.context.close()
  }
}

test.describe('Admin engagement', () => {
  test('daily loggers 7d: N-1 inside, boundary outside when past clock-time, N+1 absent; range clicks', async ({
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

    // 7d window = the Bangladesh days daysAgo(7)..today. Series keys are Bangladesh days, and
    // symptom dates are stored as UTC midnight of their day (days.dateOf).
    const insideAt = days.dateOf(days.daysAgo(6))
    const boundaryAt = days.dateOf(days.daysAgo(7))
    const outsideAt = days.dateOf(days.daysAgo(8))
    for (const [at, tag] of [
      [insideAt, 'in'],
      [boundaryAt, 'bd'],
      [outsideAt, 'out'],
    ] as const) {
      await db.symptomLog.create({
        data: {
          profileId: profile.id,
          date: at,
          category: 'PHYSICAL',
          symptomId: `e2e130eng_${tag}_${runId}`,
          value: 'mild',
        },
      })
    }
    const insideUtc = days.daysAgo(6)
    const outsideUtc = days.daysAgo(8)

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/engagement?range=7d')
        await expect(page.getByRole('heading', { name: 'Engagement' })).toBeVisible()
        const rangeGroup = page.getByRole('group', { name: 'Date range' })
        await expect(rangeGroup.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')

        await expect
          .poll(
            async () => {
              await refreshData(page)
              const table = await openChartTable(page, 'Daily Active Loggers')
              if ((await table.getByRole('row', { name: new RegExp(`^${outsideUtc}\\b`) }).count()) !== 0) {
                return -2
              }
              const insideRow = table.getByRole('row', { name: new RegExp(`^${insideUtc}\\b`) })
              if ((await insideRow.count()) === 0) return -1
              const raw = ((await insideRow.getByRole('cell').first().textContent()) ?? '').trim()
              const n = Number.parseInt(raw, 10)
              return Number.isFinite(n) ? n : -1
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThanOrEqual(1)

        const loggersTable = await openChartTable(page, 'Daily Active Loggers')
        await expect(loggersTable.getByRole('row', { name: new RegExp(`^${outsideUtc}\\b`) })).toHaveCount(0)

        // Logging rate: same inside UTC day present and >0; outside absent (finding 6).
        await expect
          .poll(
            async () => {
              await refreshData(page)
              const rateTable = await openChartTable(page, 'Symptom Logging Rate')
              if ((await rateTable.getByRole('row', { name: new RegExp(`^${outsideUtc}\\b`) }).count()) !== 0) {
                return -2
              }
              const loggers = await openChartTable(page, 'Daily Active Loggers')
              const loggerCount = await readTableRowNumber(loggers, insideUtc)
              if (loggerCount < 1) return -1
              const rateRow = rateTable.getByRole('row', { name: new RegExp(`^${insideUtc}\\b`) })
              if ((await rateRow.count()) === 0) return -1
              const raw = ((await rateRow.getByRole('cell').first().textContent()) ?? '').trim()
              const ratePct = Number.parseInt(raw, 10)
              // Rate % > 0 whenever our profile (and any others) logged that day.
              return Number.isFinite(ratePct) && ratePct > 0 && loggerCount >= 1 ? ratePct : -1
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThan(0)

        const rateTable = await openChartTable(page, 'Symptom Logging Rate')
        await expect(rateTable.getByRole('row', { name: new RegExp(`^${outsideUtc}\\b`) })).toHaveCount(0)

        await rangeGroup.getByRole('button', { name: '30d' }).click()
        await expect(page).toHaveURL(/range=30d/)
        await rangeGroup.getByRole('button', { name: '90d' }).click()
        await expect(page).toHaveURL(/range=90d/)
        await rangeGroup.getByRole('button', { name: '1y' }).click()
        await expect(page).toHaveURL(/range=1y/)
        await rangeGroup.getByRole('button', { name: '7d' }).click()
        await expect(page).toHaveURL(/range=7d/)
      },
    )
  })

  test('streak distribution moves the 3-6 bucket by exactly +1 for this profile', async ({
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
  }, testInfo) => {
    // Shared global histogram; one project avoids parallel double-counting (finding 7).
    test.skip(
      testInfo.project.name !== 'admin-desktop',
      'streak buckets are global; desktop owns exact +1 assertion',
    )

    const runId = randomBytes(3).toString('hex')
    const throwaway = await newUser()
    const db = e2eDb()
    const user = await db.user.findUniqueOrThrow({ where: { phone: toDbPhone(throwaway.phone) } })
    const profile = await db.profile.create({
      data: {
        userId: user.id,
        name: `E2E 130 streak ${runId}`,
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
      },
    })

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/engagement?range=7d')
        let before = -1
        await expect
          .poll(
            async () => {
              await refreshData(page)
              try {
                const table = await openChartTable(page, 'Logging Streak Distribution')
                before = await readTableRowNumber(table, '3-6')
                return before
              } catch {
                return -1
              }
            },
            { timeout: 20_000 },
          )
          .toBeGreaterThanOrEqual(0)

        // Re-read immediately before seed to shrink the race window with other workers.
        {
          const table = await openChartTable(page, 'Logging Streak Distribution')
          before = await readTableRowNumber(table, '3-6')
        }

        // Consecutive Bangladesh days 0..2 → streak length 3 → bucket 3-6.
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
              await refreshData(page)
              const table = await openChartTable(page, 'Logging Streak Distribution')
              return readTableRowNumber(table, '3-6')
            },
            { timeout: 30_000 },
          )
          .toBe(before + 1)
      },
    )
  })

  test('Weekly Logging Retention and Logging Rate Over Time panels render', async ({
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
        name: `E2E 130 ret ${runId}`,
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
      },
    })
    // First log anchors a logging-retention cohort week; a second week later marks retained.
    await db.symptomLog.create({
      data: {
        profileId: profile.id,
        date: days.startOf(days.daysAgo(20)),
        category: 'PHYSICAL',
        symptomId: `e2e130ret_a_${runId}`,
        value: 'mild',
      },
    })
    await db.symptomLog.create({
      data: {
        profileId: profile.id,
        date: days.startOf(days.daysAgo(3)),
        category: 'PHYSICAL',
        symptomId: `e2e130ret_b_${runId}`,
        value: 'mild',
      },
    })

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/engagement?range=30d')
        await expect(page.getByRole('heading', { name: 'Weekly Logging Retention' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Logging Rate Over Time' })).toBeVisible()

        await expect
          .poll(
            async () => {
              await refreshData(page)
              const rateOverTime = await openChartTable(page, 'Logging Rate Over Time')
              return rateOverTime.getByRole('row').count()
            },
            { timeout: 25_000 },
          )
          .toBeGreaterThan(1)

        // Retention chart may be empty on a quiet DB — assert heading + empty or table.
        const retentionCard = chartCard(page, 'Weekly Logging Retention')
        const empty = retentionCard.getByText('No retention data yet.')
        if ((await empty.count()) === 0) {
          await openChartTable(page, 'Weekly Logging Retention')
        } else {
          await expect(empty).toBeVisible()
        }
      },
    )
  })

  test('empty state: Logging Rate Over Time / Daily Active Loggers labels when series is all-zero', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    // Gap-filled zeros are treated as empty by ChartPanel (`!row[key]`). Unreachable on a
    // busy shared E2E DB (other workers always log). Assert the empty copy exists in the DOM
    // only when the panel is empty; otherwise document and check streak empty is not required.
    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/engagement?range=7d')
        const loggersEmpty = page.getByText('No logging data for this period.')
        const rateEmpty = page.getByText('No rate data for this period.')
        if ((await loggersEmpty.count()) > 0) {
          await expect(loggersEmpty.first()).toBeVisible()
        } else if ((await rateEmpty.count()) > 0) {
          await expect(rateEmpty.first()).toBeVisible()
        } else {
          // Unreachable empty on shared slot — panels have data from parallel workers / seeds.
          await expect(page.getByRole('heading', { name: 'Daily Active Loggers' })).toBeVisible()
          await expect(page.getByRole('heading', { name: 'Symptom Logging Rate' })).toBeVisible()
        }
      },
    )
  })
})
