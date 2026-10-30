import { randomBytes } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { chartCard, openChartTable, refreshData, type AdminBrowserOpts } from '../../support/admin-charts'
import { e2eDb } from '../../support/db'
import { toDbPhone } from '../../support/users'
import type { BangladeshDays } from '../../support/bangladesh-day'

const DAY_MS = 24 * 60 * 60 * 1000

/** Phase top-symptoms `<dl>` — scoped to the section that owns the phase heading. */
function phaseSymptomsDl(page: Page) {
  // eslint-disable-next-line playwright/no-raw-locators -- section wrapper of the phase heading has no role/name; the <dl> is reached through it
  return page
    .getByRole('heading', { name: 'Symptom Logs by Cycle Phase', exact: true })
    .locator('xpath=ancestor::div[./dl][1]')
    .locator('dl')
}

/** UTC YYYY-MM-DD matching analytics-service `toISOString` bucketing (bug #146). */
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

test.describe('Admin analytics', () => {
  test('symptoms-by-phase: N-1 / boundary / N+1 edges, PanelRange click, exact top count', async ({
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
    // Distinct ids so labels stay unique under parallel workers (humanize keeps alphanumerics).
    // Clear inside (N-1 relative to a comfortable margin), exact boundary N=30, outside N+1=31.
    // UTC-aligned [to−30d, to]: BD midnight of daysAgo(30) is usually just inside or just
    // outside depending on `now` within the UTC day — we treat presence of boundary as the
    // observed side and always require daysAgo(1) inside / daysAgo(35) outside.
    const nearId = `e2e130p1${runId}`
    const boundaryId = `e2e130p30${runId}`
    const outsideId = `e2e130p35${runId}`
    // topN=5 per phase; purge prior #130 phase markers so --repeat-each cannot fill top-N.
    const copies = 40
    const db = e2eDb()
    await db.symptomLog.deleteMany({ where: { symptomId: { startsWith: 'e2e130p' } } })

    const throwaway = await newUser()
    const profile = await ensureProfileForPhone(throwaway.phone, `E2E 130 phase ${runId}`)

    await seedMenstrualSymptom(profile.id, days, { dayOffset: 1, symptomId: nearId, copies })
    await seedMenstrualSymptom(profile.id, days, { dayOffset: 30, symptomId: boundaryId, copies })
    await seedMenstrualSymptom(profile.id, days, { dayOffset: 35, symptomId: outsideId, copies })

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?phase=30d&sym=30d&mae=30d&trend=7d&tm=active')
        await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

        const phaseCard = chartCard(page, 'Symptom Logs by Cycle Phase')
        await expect(
          phaseCard.getByRole('group', { name: 'Date range' }).getByRole('button', { name: '30d' }),
        ).toHaveAttribute('aria-pressed', 'true')

        await expect
          .poll(
            async () => {
              await refreshData(page)
              const text = await phaseSymptomsDl(page).innerText()
              return text.includes(`${nearId} (${copies})`) && !text.includes(outsideId)
            },
            { timeout: 45_000 },
          )
          .toBe(true)

        const dl = phaseSymptomsDl(page)
        await expect(dl).toContainText(`${nearId} (${copies})`)
        await expect(dl).not.toContainText(outsideId)
        // Boundary daysAgo(30): record which side the UTC-aligned window landed on.
        const boundaryInside = (await dl.innerText()).includes(`${boundaryId} (${copies})`)

        const phaseTable = await openChartTable(page, 'Symptom Logs by Cycle Phase')
        const menstrualRow = phaseTable.getByRole('row', { name: /MENSTRUAL/i })
        await expect(menstrualRow).toBeVisible()
        const menstrualCount = Number.parseInt(
          ((await menstrualRow.getByRole('cell').first().textContent()) ?? '0').trim(),
          10,
        )
        expect(menstrualCount).toBeGreaterThanOrEqual(copies)

        // Widen via PanelRange: 90d must surface the outside seed (topN=5 — parallel
        // desktop+phone each seed 3 ids, so only assert the previously excluded outside).
        await chartCard(page, 'Symptom Logs by Cycle Phase')
          .getByRole('group', { name: 'Date range' })
          .getByRole('button', { name: '90d' })
          .click()
        await expect(page).toHaveURL(/phase=90d/)
        await expect
          .poll(
            async () => {
              await refreshData(page)
              const text = await phaseSymptomsDl(page).innerText()
              return text.includes(`${outsideId} (${copies})`)
            },
            { timeout: 45_000 },
          )
          .toBe(true)

        await chartCard(page, 'Symptom Logs by Cycle Phase')
          .getByRole('group', { name: 'Date range' })
          .getByRole('button', { name: '30d' })
          .click()
        await expect(page).toHaveURL(/phase=30d/)
        await refreshData(page)
        const dl30 = phaseSymptomsDl(page)
        await expect(dl30).toContainText(`${nearId} (${copies})`)
        await expect(dl30).not.toContainText(outsideId)
        if (boundaryInside) {
          await expect(dl30).toContainText(`${boundaryId} (${copies})`)
        } else {
          await expect(dl30).not.toContainText(boundaryId)
        }
      },
    )
  })

  test('per-tier MAE pills and 30d trend edges (desktop owns global snapshot rows)', async ({
    browser,
    days,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }, testInfo) => {
    // Finding 2: desktop+phone upsert the same (date,tier) in parallel → race.
    test.skip(
      testInfo.project.name !== 'admin-desktop',
      'PredictionAccuracySnapshot is global; one project owns upsert + restore',
    )

    const runId = randomBytes(3).toString('hex')
    const n = parseInt(runId.slice(0, 4), 16)
    // Distinct per-tier markers (finding 1).
    const avgMae = Number(`1.${(n % 80).toString().padStart(2, '0')}`)
    const arimaMae = Number(`2.${((n >> 8) % 80).toString().padStart(2, '0')}`)
    const avgSamples = 800 + (n % 150)
    const arimaSamples = 950 + (n % 40)

    const db = e2eDb()
    const latestSnapDate = new Date(days.now.toISOString().slice(0, 10))
    // Snapshots are keyed by UTC date (ADR 0006) and the 30d range is [UTC today - 30, UTC today]
    // (resolvePanelRange): count from the server's UTC day, not the Bangladesh day, so the edges hold
    // at every hour (from the Bangladesh day they only held 00:00-06:00 Bangladesh).
    const utcDaysAgo = (n: number) => new Date(latestSnapDate.getTime() - n * 24 * 60 * 60 * 1000)
    const trendInsideDate = utcDaysAgo(5)
    const trendBoundaryDate = utcDaysAgo(30)
    const trendOutsideDate = utcDaysAgo(31)

    const touchDates = [latestSnapDate, trendInsideDate, trendBoundaryDate, trendOutsideDate]
    const backup = await db.predictionAccuracySnapshot.findMany({
      where: { date: { in: touchDates } },
    })

    const upsertTier = async (
      date: Date,
      tier: 'AVERAGE' | 'ARIMA',
      maeDays: number,
      sampleSize: number,
    ) => {
      await db.predictionAccuracySnapshot.upsert({
        where: { date_tier: { date, tier } },
        create: { date, tier, maeDays, sampleSize, computedAt: days.now },
        update: { maeDays, sampleSize, computedAt: days.now },
      })
    }

    try {
      await upsertTier(latestSnapDate, 'AVERAGE', avgMae, avgSamples)
      await upsertTier(latestSnapDate, 'ARIMA', arimaMae, arimaSamples)
      await upsertTier(trendInsideDate, 'AVERAGE', 3.3, 11)
      await upsertTier(trendBoundaryDate, 'AVERAGE', 4.4, 12)
      await upsertTier(trendOutsideDate, 'AVERAGE', 9.9, 99)

      await withAdmin(
        browser,
        { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        async (page) => {
          await page.goto('/analytics?phase=30d&mae=30d&trend=7d&tm=active')
          await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

          await expect
            .poll(
              async () => {
                await upsertTier(latestSnapDate, 'AVERAGE', avgMae, avgSamples)
                await upsertTier(latestSnapDate, 'ARIMA', arimaMae, arimaSamples)
                await refreshData(page)
                // eslint-disable-next-line playwright/no-raw-locators -- tier pill is an unnamed <div>; matched by its text parts
                const avgPill = page
                  .locator('div')
                  .filter({ hasText: 'AVERAGE' })
                  .filter({ hasText: `${avgMae}d MAE` })
                  .filter({ hasText: `${avgSamples} samples` })
                // eslint-disable-next-line playwright/no-raw-locators -- tier pill is an unnamed <div>; matched by its text parts
                const arimaPill = page
                  .locator('div')
                  .filter({ hasText: 'ARIMA' })
                  .filter({ hasText: `${arimaMae}d MAE` })
                  .filter({ hasText: `${arimaSamples} samples` })
                return (await avgPill.count()) > 0 && (await arimaPill.count()) > 0
              },
              { timeout: 30_000 },
            )
            .toBe(true)

          await expect(page.getByRole('heading', { name: 'Prediction Accuracy (MAE · days)' })).toBeVisible()
          const maeTable = await openChartTable(page, 'Prediction Accuracy (MAE · days)')
          await expect(maeTable.getByRole('row', { name: /^AVERAGE\b/ })).toContainText(String(avgMae))
          await expect(maeTable.getByRole('row', { name: /^ARIMA\b/ })).toContainText(String(arimaMae))

          const maeCard = chartCard(page, 'Prediction MAE Trend (days)')
          await maeCard.getByRole('group', { name: 'Date range' }).getByRole('button', { name: '30d' }).click()
          await expect(page).toHaveURL(/mae=30d/)

          const maeTrendTable = await openChartTable(page, 'Prediction MAE Trend (days)')
          const insideKey = utcDayKey(trendInsideDate)
          const boundaryKey = utcDayKey(trendBoundaryDate)
          const outsideKey = utcDayKey(trendOutsideDate)
          await expect(maeTrendTable.getByRole('row', { name: new RegExp(`^${insideKey}\\b`) })).toBeVisible()
          // UTC today - 30 is the inclusive edge; UTC today - 31 is outside.
          await expect(maeTrendTable.getByRole('row', { name: new RegExp(`^${boundaryKey}\\b`) })).toBeVisible()
          await expect(maeTrendTable.getByRole('row', { name: new RegExp(`^${outsideKey}\\b`) })).toHaveCount(0)
        },
      )
    } finally {
      // Restore prior nightly rows; delete rows we created that were not backed up.
      const backupKeys = new Set(backup.map((r) => `${r.date.toISOString()}|${r.tier}`))
      for (const date of touchDates) {
        for (const tier of ['AVERAGE', 'ARIMA'] as const) {
          const key = `${date.toISOString()}|${tier}`
          const prior = backup.find((r) => r.date.getTime() === date.getTime() && r.tier === tier)
          if (prior) {
            await db.predictionAccuracySnapshot.upsert({
              where: { date_tier: { date, tier } },
              create: {
                date,
                tier,
                maeDays: prior.maeDays,
                sampleSize: prior.sampleSize,
                computedAt: prior.computedAt,
              },
              update: {
                maeDays: prior.maeDays,
                sampleSize: prior.sampleSize,
                computedAt: prior.computedAt,
              },
            })
          } else if (!backupKeys.has(key)) {
            await db.predictionAccuracySnapshot.deleteMany({ where: { date, tier } })
          }
        }
      }
    }
  })

  test('7d activity trend: N-1 inside, boundary side documented, N+1 outside; PanelRange + metrics', async ({
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
    const profile = await ensureProfileForPhone(throwaway.phone, `E2E 130 trend ${runId}`)
    const db = e2eDb()

    // getTrendMetric(active, 7) → rolling now−7d. Boundary daysAgo(7) at BD midnight is
    // typically *outside* when server now is later that clock-time (startDate = now−7d).
    const insideAt = days.startOf(days.daysAgo(6))
    const boundaryAt = days.startOf(days.daysAgo(7))
    const outsideAt = days.startOf(days.daysAgo(8))
    for (const [at, tag] of [
      [insideAt, 'in'],
      [boundaryAt, 'bd'],
      [outsideAt, 'out'],
    ] as const) {
      await db.symptomLog.create({
        data: {
          profileId: profile.id,
          date: at,
          category: 'MOOD',
          symptomId: `e2e130t7${tag}${runId}`,
          value: 'x',
        },
      })
    }
    // Chart row labels are UTC keys today (#146); seeds are Bangladesh days.
    const insideUtc = utcDayKey(insideAt)
    const outsideUtc = utcDayKey(outsideAt)

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?trend=7d&tm=active')
        await expect(page.getByRole('heading', { name: 'User Activity Trend' })).toBeVisible()

        const trendCard = chartCard(page, 'User Activity Trend')
        const rangeGroup = trendCard.getByRole('group', { name: 'Date range' })
        const metricGroup = trendCard.getByRole('group', { name: 'Metric' })
        await expect(rangeGroup.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')
        await expect(metricGroup.getByRole('button', { name: 'Active loggers' })).toHaveAttribute(
          'aria-pressed',
          'true',
        )

        await expect
          .poll(
            async () => {
              await refreshData(page)
              const table = await openChartTable(page, 'User Activity Trend')
              const insideRow = table.getByRole('row', { name: new RegExp(`^${insideUtc}\\b`) })
              if ((await insideRow.count()) === 0) return -1
              const raw = ((await insideRow.getByRole('cell').first().textContent()) ?? '').trim()
              const n = Number.parseInt(raw, 10)
              return Number.isFinite(n) ? n : -1
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThanOrEqual(1)

        const trendTable = await openChartTable(page, 'User Activity Trend')
        await expect(trendTable.getByRole('row', { name: new RegExp(`^${outsideUtc}\\b`) })).toHaveCount(0)

        // Exercise PanelRange + metric picker.
        await rangeGroup.getByRole('button', { name: '30d' }).click()
        await expect(page).toHaveURL(/trend=30d/)
        await rangeGroup.getByRole('button', { name: '7d' }).click()
        await expect(page).toHaveURL(/trend=7d/)
        await metricGroup.getByRole('button', { name: 'Sign-ups' }).click()
        await expect(page).toHaveURL(/tm=signups/)
        await metricGroup.getByRole('button', { name: 'Logging rate' }).click()
        await expect(page).toHaveURL(/tm=logRate/)
        await metricGroup.getByRole('button', { name: 'Active loggers' }).click()
        await expect(page).toHaveURL(/tm=active/)
        await rangeGroup.getByRole('button', { name: '1y' }).click()
        await expect(page).toHaveURL(/trend=1y/)
      },
    )
  })

  // App buckets with toISOString (UTC); desired key is the Bangladesh day — #146.
  test('activity trend day keys should equal the Bangladesh day of the log', async ({ days }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/146')
    const bdDay = days.daysAgo(1)
    // Mirrors getDailyActiveLoggers / getTrendMetric active bucketing today.
    expect(days.startOf(bdDay).toISOString().slice(0, 10)).toBe(bdDay)
  })

  test('cycle-length distribution reflects throwaway period gaps', async ({
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
    const profile = await ensureProfileForPhone(throwaway.phone, `E2E 130 cyc ${runId}`)
    const db = e2eDb()
    // Distinctive 33-day gap (unusual vs seed 28) ending inside the 90d window.
    const secondStart = days.startOf(days.daysAgo(5))
    const firstStart = new Date(secondStart.getTime() - 33 * DAY_MS)
    await db.periodLog.createMany({
      data: [
        {
          profileId: profile.id,
          startDate: firstStart,
          endDate: new Date(firstStart.getTime() + 4 * DAY_MS),
          flowIntensity: 'MEDIUM',
        },
        {
          profileId: profile.id,
          startDate: secondStart,
          endDate: new Date(secondStart.getTime() + 4 * DAY_MS),
          flowIntensity: 'MEDIUM',
        },
      ],
    })

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?cyc=90d')
        const card = chartCard(page, 'Cycle Length Distribution')
        await card.getByRole('group', { name: 'Date range' }).getByRole('button', { name: '90d' }).click()
        await expect
          .poll(
            async () => {
              await refreshData(page)
              const table = await openChartTable(page, 'Cycle Length Distribution')
              return table.getByRole('row', { name: /^33\b/ }).count()
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThan(0)
      },
    )
  })

  test('symptoms-by-category includes throwaway PHYSICAL logs in range', async ({
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
    const profile = await ensureProfileForPhone(throwaway.phone, `E2E 130 sym ${runId}`)
    await e2eDb().symptomLog.createMany({
      data: Array.from({ length: 7 }, () => ({
        profileId: profile.id,
        date: days.startOf(days.daysAgo(2)),
        category: 'PHYSICAL' as const,
        symptomId: `e2e130sym${runId}`,
        value: 'mild',
      })),
    })

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?sym=30d')
        const card = chartCard(page, 'Symptoms by Category')
        await card.getByRole('group', { name: 'Date range' }).getByRole('button', { name: '30d' }).click()
        await expect
          .poll(
            async () => {
              await refreshData(page)
              const table = await openChartTable(page, 'Symptoms by Category')
              const row = table.getByRole('row', { name: /PHYSICAL/i })
              if ((await row.count()) === 0) return -1
              const raw = ((await row.getByRole('cell').first().textContent()) ?? '').trim()
              return Number.parseInt(raw, 10)
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThanOrEqual(7)
      },
    )
  })

  test('prediction confidence panel + metric picker reflect seeded prediction', async ({
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
    const profile = await ensureProfileForPhone(throwaway.phone, `E2E 130 pred ${runId}`)
    const next = days.startOf(days.daysFromNow(14))
    await e2eDb().prediction.create({
      data: {
        profileId: profile.id,
        tier: 'ARIMA',
        nextPeriodStart: next,
        ovulationDay: days.startOf(days.daysFromNow(7)),
        fertileStart: days.startOf(days.daysFromNow(5)),
        fertileEnd: days.startOf(days.daysFromNow(9)),
        confidence: 0.87,
      },
    })

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?acc=30d&accm=count')
        const card = chartCard(page, 'Prediction Accuracy by Tier')
        await card.getByRole('group', { name: 'Date range' }).getByRole('button', { name: '30d' }).click()
        await card.getByRole('group', { name: 'Metric' }).getByRole('button', { name: 'Predictions' }).click()
        await expect(page).toHaveURL(/accm=count/)
        await expect
          .poll(
            async () => {
              await refreshData(page)
              const table = await openChartTable(page, 'Prediction Accuracy by Tier')
              return table.getByRole('row', { name: /^ARIMA\b/ }).count()
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThan(0)
        await card.getByRole('group', { name: 'Metric' }).getByRole('button', { name: 'Confidence' }).click()
        await expect(page).toHaveURL(/accm=confidence/)
      },
    )
  })

  test('retention panel range control is exercised', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?ret=30d')
        await expect(page.getByRole('heading', { name: 'Retention by Signup Cohort' })).toBeVisible()
        const retRange = () =>
          chartCard(page, 'Retention by Signup Cohort').getByRole('group', { name: 'Date range' })
        await expect(retRange().getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'true')
        await retRange().getByRole('button', { name: '60d' }).click()
        await expect(page).toHaveURL(/ret=60d/)
        await expect(retRange().getByRole('button', { name: '60d' })).toHaveAttribute('aria-pressed', 'true')
        await retRange().getByRole('button', { name: '90d' }).click()
        await expect(page).toHaveURL(/ret=90d/)
        await expect(retRange().getByRole('button', { name: '90d' })).toHaveAttribute('aria-pressed', 'true')
      },
    )
  })

  test('feedback panels: volume reflects seeded submission; empty reachable when none in window', async ({
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
    // Seed has no Feedback rows; 7d empty labels are reachable unless another worker just wrote.
    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?fb=7d')
        await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeVisible()
        const fbRange = page
          .getByRole('region', { name: 'Feedback analytics' })
          .getByRole('group', { name: 'Date range' })
        // Feedback section uses <section aria-label>; if empty, assert empty labels.
        await expect(fbRange.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')

        const volumeEmpty = page.getByText('No submissions in this period.')
        const categoryEmpty = page.getByText('No category data.')
        if ((await volumeEmpty.count()) > 0) {
          await expect(volumeEmpty.first()).toBeVisible()
          await expect(categoryEmpty.first()).toBeVisible()
        } else {
          // Parallel worker feedback may fill 7d — still exercise the range control.
          await fbRange.getByRole('button', { name: '30d' }).click()
          await expect(page).toHaveURL(/fb=30d/)
        }
      },
    )

    const runId = randomBytes(3).toString('hex')
    const throwaway = await newUser()
    const user = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(throwaway.phone) } })
    await e2eDb().feedback.create({
      data: {
        userId: user.id,
        category: 'BUG',
        message: `e2e130 feedback ${runId}`,
        rating: 4,
        createdAt: days.now,
      },
    })

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        // The analytics page's Refresh only busts the analytics cache tag, not the feedback panels'
        // (cached 5 min, and warmed empty by the check above): bust it from /feedback, then come back.
        await page.goto('/feedback')
        await refreshData(page)
        await page.goto('/analytics?fb=7d')
        const fbRange = page
          .getByRole('region', { name: 'Feedback analytics' })
          .getByRole('group', { name: 'Date range' })
        await fbRange.getByRole('button', { name: '7d' }).click()
        await expect
          .poll(
            async () => {
              await refreshData(page)
              const table = await openChartTable(page, 'Feedback Volume')
              // At least one day row with count ≥ 1 (UTC-keyed).
              const rows = table.getByRole('row')
              const n = await rows.count()
              for (let i = 1; i < n; i++) {
                const raw = ((await rows.nth(i).getByRole('cell').first().textContent()) ?? '').trim()
                const v = Number.parseInt(raw, 10)
                if (Number.isFinite(v) && v >= 1) return v
              }
              return -1
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThanOrEqual(1)

        await expect(page.getByRole('heading', { name: 'By Category', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Rating Distribution', exact: true })).toBeVisible()
        await page
          .getByRole('region', { name: 'Feedback analytics' })
          .getByRole('group', { name: 'Date range' })
          .getByRole('button', { name: '1y' })
          .click()
        await expect(page).toHaveURL(/fb=1y/)
      },
    )
  })
})
