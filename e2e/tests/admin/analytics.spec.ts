import { randomBytes } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'
import { toDbPhone } from '../../support/users'
import type { BangladeshDays } from '../../support/bangladesh-day'

const DAY_MS = 24 * 60 * 60 * 1000

/** Click Refresh data and wait for the revalidate + router.refresh transition to finish. */
async function refreshAnalytics(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: 'Refresh data' })
  await btn.click()
  await expect(btn).toBeEnabled({ timeout: 15_000 })
}

/** ChartPanel card that owns the given h2 title (includes "View data as table"). */
function chartCard(page: Page, title: string) {
  return page
    .getByRole('heading', { name: title, exact: true })
    .locator('xpath=ancestor::div[.//summary[contains(., "View data as table")]][1]')
}

/** Expand the accessible data table for a ChartPanel (caption = panel title). */
async function openChartTable(page: Page, title: string) {
  const card = chartCard(page, title)
  const table = card.getByRole('table', { name: title })
  if (!(await table.isVisible().catch(() => false))) {
    await card.getByText('View data as table').click()
  }
  await expect(table).toBeVisible({ timeout: 10_000 })
  return table
}

/** UTC YYYY-MM-DD key matching analytics-service daily buckets. */
function utcDayKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

async function ensureProfileForPhone(phone: string, name: string) {
  const db = e2eDb()
  const user = await db.user.findUniqueOrThrow({ where: { phone: toDbPhone(phone) } })
  return db.profile.create({
    data: {
      userId: user.id,
      name,
      relation: 'SELF',
      cycleLength: 28,
      periodLength: 5,
    },
  })
}

async function seedMenstrualSymptom(
  profileId: string,
  days: BangladeshDays,
  opts: { dayOffset: number; symptomId: string; copies?: number },
) {
  const db = e2eDb()
  const copies = opts.copies ?? 1
  const logDay = days.daysAgo(opts.dayOffset)
  // Period starts 1 Bangladesh day before the symptom so cycle day 2 = menstrual.
  const periodStart = days.startOf(days.daysAgo(opts.dayOffset + 1))
  const periodEnd = new Date(periodStart.getTime() + 4 * DAY_MS)
  await db.periodLog.create({
    data: {
      profileId,
      startDate: periodStart,
      endDate: periodEnd,
      flowIntensity: 'MEDIUM',
    },
  })
  // Enough copies to stay in the phase panel's top-N when other workers also log.
  await db.symptomLog.createMany({
    data: Array.from({ length: copies }, () => ({
      profileId,
      date: days.startOf(logDay),
      category: 'PHYSICAL' as const,
      symptomId: opts.symptomId,
      value: 'mild',
    })),
  })
}

test.describe('Admin analytics', () => {
  test('charts, per-tier MAE, and symptoms-by-phase reflect run data; panel ranges include/exclude Bangladesh-day edges', async ({
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
    const insideSymptomId = `e2e130in${runId}`
    const outsideSymptomId = `e2e130out${runId}`
    // humanizeSymptom replaces _/- with spaces — keep ids alphanumeric so labels stay unique.
    const insideLabel = insideSymptomId
    const outsideLabel = outsideSymptomId

    const throwaway = await newUser()
    const profile = await ensureProfileForPhone(throwaway.phone, `E2E 130 ${runId}`)

    // Just inside / just outside a 30d phase window (panel min for symptoms-by-phase).
    // 25 copies keeps our id in the top-N dl under parallel workers.
    await seedMenstrualSymptom(profile.id, days, {
      dayOffset: 1,
      symptomId: insideSymptomId,
      copies: 25,
    })
    await seedMenstrualSymptom(profile.id, days, {
      dayOffset: 35,
      symptomId: outsideSymptomId,
      copies: 25,
    })

    // Distinctive MAE snapshot for "latest" pills + in/out of a 30d MAE trend window.
    const db = e2eDb()
    const maeDaysMarker = Number(`1.${(parseInt(runId.slice(0, 2), 16) % 80).toString().padStart(2, '0')}`)
    const sampleMarker = 800 + (parseInt(runId.slice(2), 16) % 150)
    const latestSnapDate = new Date(days.now.toISOString().slice(0, 10))
    const trendInsideDate = new Date(days.startOf(days.daysAgo(5)).toISOString().slice(0, 10))
    const trendOutsideDate = new Date(days.startOf(days.daysAgo(40)).toISOString().slice(0, 10))

    for (const tier of ['AVERAGE', 'ARIMA'] as const) {
      await db.predictionAccuracySnapshot.upsert({
        where: { date_tier: { date: latestSnapDate, tier } },
        create: {
          date: latestSnapDate,
          tier,
          maeDays: maeDaysMarker,
          sampleSize: sampleMarker,
          computedAt: days.now,
        },
        update: {
          maeDays: maeDaysMarker,
          sampleSize: sampleMarker,
          computedAt: days.now,
        },
      })
    }
    await db.predictionAccuracySnapshot.upsert({
      where: { date_tier: { date: trendInsideDate, tier: 'AVERAGE' } },
      create: {
        date: trendInsideDate,
        tier: 'AVERAGE',
        maeDays: 3.3,
        sampleSize: 11,
        computedAt: days.now,
      },
      update: { maeDays: 3.3, sampleSize: 11, computedAt: days.now },
    })
    await db.predictionAccuracySnapshot.upsert({
      where: { date_tier: { date: trendOutsideDate, tier: 'AVERAGE' } },
      create: {
        date: trendOutsideDate,
        tier: 'AVERAGE',
        maeDays: 9.9,
        sampleSize: 99,
        computedAt: days.now,
      },
      update: { maeDays: 9.9, sampleSize: 99, computedAt: days.now },
    })

    // 7d User Activity Trend (active loggers): Bangladesh-day edges of the rolling window.
    const inside7 = days.startOf(days.daysAgo(1))
    const outside7 = days.startOf(days.daysAgo(8))
    await db.symptomLog.create({
      data: {
        profileId: profile.id,
        date: inside7,
        category: 'MOOD',
        symptomId: `e2e130t7in${runId}`,
        value: 'x',
      },
    })
    await db.symptomLog.create({
      data: {
        profileId: profile.id,
        date: outside7,
        category: 'MOOD',
        symptomId: `e2e130t7out${runId}`,
        value: 'x',
      },
    })
    const inside7Key = utcDayKey(inside7)
    const outside7Key = utcDayKey(outside7)

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

      // ── Symptoms by phase: 30d includes near edge, excludes far edge ─────────
      await page.goto(`/analytics?phase=30d&sym=30d&mae=30d&trend=7d&tm=active`)
      await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

      await expect
        .poll(
          async () => {
            await refreshAnalytics(page)
            const phaseText = await page.locator('dl').innerText()
            return phaseText.includes(`${insideLabel} (`)
          },
          { timeout: 25_000 },
        )
        .toBe(true)

      const phaseDl = page.locator('dl')
      await expect(phaseDl).toContainText(`${insideLabel} (`)
      await expect(phaseDl).not.toContainText(outsideLabel)

      // Symptoms by Category table: PHYSICAL count is global — assert via phase-scoped
      // chart table that MENSTRUAL has at least our inside log (parallel-safe ≥).
      const phaseTable = await openChartTable(page, 'Symptom Logs by Cycle Phase')
      const menstrualRow = phaseTable.getByRole('row', { name: /MENSTRUAL/i })
      await expect(menstrualRow).toBeVisible()
      const menstrualCount = Number.parseInt(
        ((await menstrualRow.getByRole('cell').first().textContent()) ?? '0').trim(),
        10,
      )
      expect(menstrualCount).toBeGreaterThanOrEqual(1)

      // Widen phase to 90d — outside Bangladesh-day seed must appear in the phase dl.
      await page.goto(`/analytics?phase=90d&sym=30d&mae=30d&trend=7d&tm=active`)
      await expect
        .poll(
          async () => {
            await refreshAnalytics(page)
            const text = await page.locator('dl').innerText()
            return text.includes(`${outsideLabel} (`) && text.includes(`${insideLabel} (`)
          },
          { timeout: 25_000 },
        )
        .toBe(true)

      const phaseTable90 = await openChartTable(page, 'Symptom Logs by Cycle Phase')
      const menstrual90 = Number.parseInt(
        (
          (await phaseTable90
            .getByRole('row', { name: /MENSTRUAL/i })
            .getByRole('cell')
            .first()
            .textContent()) ?? '0'
        ).trim(),
        10,
      )
      expect(menstrual90).toBeGreaterThanOrEqual(menstrualCount + 25)

      // ── Per-tier MAE pills from the run's snapshot ───────────────────────────
      await page.goto(`/analytics?phase=30d&mae=30d&trend=7d&tm=active`)
      await expect
        .poll(
          async () => {
            // Re-assert snapshot in case a parallel worker overwrote the same UTC day.
            for (const tier of ['AVERAGE', 'ARIMA'] as const) {
              await db.predictionAccuracySnapshot.upsert({
                where: { date_tier: { date: latestSnapDate, tier } },
                create: {
                  date: latestSnapDate,
                  tier,
                  maeDays: maeDaysMarker,
                  sampleSize: sampleMarker,
                  computedAt: new Date(),
                },
                update: {
                  maeDays: maeDaysMarker,
                  sampleSize: sampleMarker,
                  computedAt: new Date(),
                },
              })
            }
            await refreshAnalytics(page)
            return page.getByText(`${sampleMarker} samples`).count()
          },
          { timeout: 25_000 },
        )
        .toBeGreaterThanOrEqual(1)

      await expect(page.getByRole('heading', { name: 'Prediction Accuracy (MAE · days)' })).toBeVisible()
      await expect(page.getByText(`${maeDaysMarker}d MAE`).first()).toBeVisible()

      // MAE trend 30d: inside date present, outside excluded (Bangladesh-day edges via days helper).
      const maeTrendTable = await openChartTable(page, 'Prediction MAE Trend (days)')
      const insideTrendKey = utcDayKey(trendInsideDate)
      const outsideTrendKey = utcDayKey(trendOutsideDate)
      await expect(maeTrendTable.getByRole('row', { name: new RegExp(insideTrendKey) })).toBeVisible()
      await expect(maeTrendTable.getByRole('row', { name: new RegExp(outsideTrendKey) })).toHaveCount(0)

      // ── 7d activity trend: include daysAgo(1), exclude daysAgo(8) ────────────
      await expect(page.getByRole('heading', { name: 'User Activity Trend' })).toBeVisible()
      // Metric "Active loggers" is set via tm=active in the URL.
      await expect(page.getByRole('button', { name: 'Active loggers' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await expect
        .poll(
          async () => {
            await refreshAnalytics(page)
            const table = await openChartTable(page, 'User Activity Trend')
            const insideRow = table.getByRole('row', { name: new RegExp(`^${inside7Key}\\b`) })
            if ((await insideRow.count()) === 0) return -1
            const raw = ((await insideRow.getByRole('cell').first().textContent()) ?? '').trim()
            const n = Number.parseInt(raw, 10)
            return Number.isFinite(n) ? n : -1
          },
          { timeout: 25_000 },
        )
        .toBeGreaterThanOrEqual(1)

      const trendTable = await openChartTable(page, 'User Activity Trend')
      await expect(trendTable.getByRole('row', { name: new RegExp(`^${outside7Key}\\b`) })).toHaveCount(0)
    } finally {
      await admin.context.close()
    }
  })
})
