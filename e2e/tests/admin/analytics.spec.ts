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

/** UTC YYYY-MM-DD, for the MAE trend (stored `date` of prediction snapshots). */
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
  test('symptoms-by-phase: N-1 / boundary / N+1 edges, shared range click, exact top count', async ({
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
    // The 30d preset is the 30 Bangladesh days ending today, inclusive: daysAgo(29) is the first
    // day inside, daysAgo(30) the first outside, at every hour (#207).
    const nearId = `e2e130p1${runId}`
    const boundaryId = `e2e130p29${runId}`
    const justOutsideId = `e2e130p30${runId}`
    const outsideId = `e2e130p35${runId}`
    // topN=5 per phase; purge prior #130 phase markers so --repeat-each cannot fill top-N.
    const copies = 40
    const db = e2eDb()
    await db.symptomLog.deleteMany({ where: { symptomId: { startsWith: 'e2e130p' } } })

    const throwaway = await newUser()
    const profile = await ensureProfileForPhone(throwaway.phone, `E2E 130 phase ${runId}`)

    await seedMenstrualSymptom(profile.id, days, { dayOffset: 1, symptomId: nearId, copies })
    await seedMenstrualSymptom(profile.id, days, { dayOffset: 29, symptomId: boundaryId, copies })
    await seedMenstrualSymptom(profile.id, days, { dayOffset: 30, symptomId: justOutsideId, copies })
    await seedMenstrualSymptom(profile.id, days, { dayOffset: 35, symptomId: outsideId, copies })

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?range=30d&tm=active')
        await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

        const rangeGroup = page.getByRole('group', { name: 'Date range' })
        await expect(rangeGroup.getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'true')

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
        // Both edges are exact: daysAgo(29) inside, daysAgo(30) outside.
        await expect(dl).toContainText(`${boundaryId} (${copies})`)
        await expect(dl).not.toContainText(justOutsideId)

        const phaseTable = await openChartTable(page, 'Symptom Logs by Cycle Phase')
        const menstrualRow = phaseTable.getByRole('row', { name: /MENSTRUAL/i })
        await expect(menstrualRow).toBeVisible()
        const menstrualCount = Number.parseInt(
          ((await menstrualRow.getByRole('cell').first().textContent()) ?? '0').trim(),
          10,
        )
        expect(menstrualCount).toBeGreaterThanOrEqual(copies)

        // Widen via the shared range: 90d must surface the outside seed (topN=5 — parallel
        // desktop+phone each seed 4 ids, so only assert the previously excluded outside).
        await rangeGroup.getByRole('button', { name: '90d' }).click()
        await expect(page).toHaveURL(/range=90d/)
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

        await rangeGroup.getByRole('button', { name: '30d' }).click()
        await expect(page).toHaveURL(/range=30d/)
        await refreshData(page)
        const dl30 = phaseSymptomsDl(page)
        await expect(dl30).toContainText(`${nearId} (${copies})`)
        await expect(dl30).not.toContainText(outsideId)
        await expect(dl30).not.toContainText(justOutsideId)
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
    // The 30d range is the 30 Bangladesh days ending today; a snapshot row is labelled by its date,
    // so daysAgo(29) is the first day inside and daysAgo(30) the first outside, at every hour (#207).
    const trendInsideDate = days.dateOf(days.daysAgo(5))
    const trendBoundaryDate = days.dateOf(days.daysAgo(29))
    const trendOutsideDate = days.dateOf(days.daysAgo(30))

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
          await page.goto('/analytics?range=30d&tm=active')
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

          await expect(page.getByRole('group', { name: 'Date range' }).getByRole('button', { name: '30d' })).toHaveAttribute(
            'aria-pressed',
            'true',
          )

          const maeTrendTable = await openChartTable(page, 'Prediction MAE Trend (days)')
          const insideKey = utcDayKey(trendInsideDate)
          const boundaryKey = utcDayKey(trendBoundaryDate)
          const outsideKey = utcDayKey(trendOutsideDate)
          await expect(maeTrendTable.getByRole('row', { name: new RegExp(`^${insideKey}\\b`) })).toBeVisible()
          // Bangladesh today - 29 is the inclusive edge; today - 30 is outside.
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

  test('7d activity trend: edges exact; shared range + metrics', async ({
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

    // 7d = the 7 Bangladesh days ending today: daysAgo(6) is the first day inside, daysAgo(7) outside.
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
          category: 'MOOD',
          symptomId: `e2e130t7${tag}${runId}`,
          value: 'x',
        },
      })
    }
    // Chart row labels are Bangladesh days.
    const insideDay = days.daysAgo(6)
    const outsideDay = days.daysAgo(8)

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?range=7d&tm=active')
        await expect(page.getByRole('heading', { name: 'User Activity Trend' })).toBeVisible()

        const trendCard = chartCard(page, 'User Activity Trend')
        const rangeGroup = page.getByRole('group', { name: 'Date range' })
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
              const insideRow = table.getByRole('row', { name: new RegExp(`^${insideDay}\\b`) })
              if ((await insideRow.count()) === 0) return -1
              const raw = ((await insideRow.getByRole('cell').first().textContent()) ?? '').trim()
              const n = Number.parseInt(raw, 10)
              return Number.isFinite(n) ? n : -1
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThanOrEqual(1)

        const trendTable = await openChartTable(page, 'User Activity Trend')
        await expect(trendTable.getByRole('row', { name: new RegExp(`^${outsideDay}\\b`) })).toHaveCount(0)

        // Exercise the shared range + metric picker.
        await rangeGroup.getByRole('button', { name: '30d' }).click()
        await expect(page).toHaveURL(/range=30d/)
        await rangeGroup.getByRole('button', { name: '7d' }).click()
        await expect(page).toHaveURL(/range=7d/)
        await metricGroup.getByRole('button', { name: 'Sign-ups' }).click()
        await expect(page).toHaveURL(/tm=signups/)
        await metricGroup.getByRole('button', { name: 'Logging rate' }).click()
        await expect(page).toHaveURL(/tm=logRate/)
        await metricGroup.getByRole('button', { name: 'Active loggers' }).click()
        await expect(page).toHaveURL(/tm=active/)
      },
    )
  })

  // https://github.com/adibahsan/cycle-circle/issues/146: signups bucket by the Bangladesh day of
  // createdAt, and the series has no empty leading bucket labelled with the day before the range.
  test('signup trend buckets a 02:00 Bangladesh signup on its Bangladesh day', async ({
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
    const throwaway = await newUser()
    const db = e2eDb()
    const bdDay = days.daysAgo(2)
    // 02:00 Bangladesh = 20:00 UTC of the day before: a UTC bucketing puts it on the wrong bar.
    await db.user.update({
      where: { phone: toDbPhone(throwaway.phone) },
      data: { createdAt: new Date(days.startOf(bdDay).getTime() + 2 * 3_600_000) },
    })
    const beforeRange = days.daysAgo(8)

    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?range=7d&tm=signups')
        await expect(page.getByRole('heading', { name: 'User Activity Trend' })).toBeVisible()
        await expect
          .poll(
            async () => {
              await refreshData(page)
              const table = await openChartTable(page, 'User Activity Trend')
              const row = table.getByRole('row', { name: new RegExp(`^${bdDay}\\b`) })
              if ((await row.count()) === 0) return -1
              return Number.parseInt(((await row.getByRole('cell').first().textContent()) ?? '').trim(), 10)
            },
            { timeout: 30_000 },
          )
          .toBeGreaterThanOrEqual(1)

        const table = await openChartTable(page, 'User Activity Trend')
        await expect(table.getByRole('row', { name: new RegExp(`^${beforeRange}\\b`) })).toHaveCount(0)
      },
    )
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
        await page.goto('/analytics?range=90d')
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
        await page.goto('/analytics?range=30d')
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
        await page.goto('/analytics?range=30d&accm=count')
        const card = chartCard(page, 'Prediction Accuracy by Tier')
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

  test('shared range control moves every panel to the picked preset', async ({
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
        await page.goto('/analytics?range=30d')
        await expect(page.getByRole('heading', { name: 'Retention by Signup Cohort' })).toBeVisible()
        const rangeGroup = page.getByRole('group', { name: 'Date range' })
        await expect(rangeGroup.getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'true')
        await rangeGroup.getByRole('button', { name: '90d' }).click()
        await expect(page).toHaveURL(/range=90d/)
        await expect(rangeGroup.getByRole('button', { name: '90d' })).toHaveAttribute('aria-pressed', 'true')
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
        await page.goto('/analytics?range=7d')
        await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeVisible()
        const fbRange = page.getByRole('group', { name: 'Date range' })
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
          await expect(page).toHaveURL(/range=30d/)
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
        await page.goto('/analytics?range=7d')
        const fbRange = page.getByRole('group', { name: 'Date range' })
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
        await fbRange.getByRole('button', { name: '90d' }).click()
        await expect(page).toHaveURL(/range=90d/)
      },
    )
  })

  // #207: a custom Bangladesh-day range lives in the URL and survives a reload.
  test('custom range in the URL survives reload; over 366 days is refused with a message', async ({
    browser,
    days,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const toDay = days.daysAgo(1)
    const fromDay = days.daysAgo(10)
    await withAdmin(
      browser,
      { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
      async (page) => {
        await page.goto('/analytics?range=7d')
        const rangeGroup = page.getByRole('group', { name: 'Date range' })
        await rangeGroup.getByRole('button', { name: 'Custom' }).click()
        await page.getByLabel('From', { exact: true }).fill(fromDay)
        await page.getByLabel('To', { exact: true }).fill(toDay)
        await page.getByRole('button', { name: 'Apply' }).click()
        await expect(page).toHaveURL(new RegExp(`from=${fromDay}&to=${toDay}`))
        await expect(page.getByText(`${fromDay} to ${toDay}`)).toBeVisible()

        await page.reload()
        await expect(page).toHaveURL(new RegExp(`from=${fromDay}&to=${toDay}`))
        await expect(page.getByText(`${fromDay} to ${toDay}`)).toBeVisible()
        await expect(rangeGroup.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')

        // A hand-edited URL over the cap shows the message and falls back to 30d.
        await page.goto(`/analytics?from=${days.daysAgo(400)}&to=${toDay}`)
        await expect(page.getByText('Pick a range of 366 days or fewer.')).toBeVisible()
        await expect(rangeGroup.getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'true')
      },
    )
  })
})
