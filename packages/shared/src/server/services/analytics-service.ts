import { prisma } from '../db'
import { ALL_GOOD_SYMPTOM_ID } from '../../utils/symptoms'
import { predictCycleLength, getPredictionTier, getCurrentPhase, MS_PER_DAY } from '../../utils/cycle-utils'

/**
 * Return KPI counts for the admin dashboard.
 */
export async function getDashboardStats() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    activeUsers,
    totalProfiles,
    proSubscribers,
    dailyLogs,
    newUsersThisWeek,
    newUsersLastWeek,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: thirtyDaysAgo } } }),
    prisma.profile.count(),
    prisma.subscription.count({ where: { status: 'PRO' } }),
    prisma.periodLog.count({ where: { createdAt: { gte: new Date(now.toDateString()) } } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          lt: sevenDaysAgo,
        },
      },
    }),
  ])

  return {
    totalUsers,
    activeUsers,
    totalProfiles,
    proSubscribers,
    dailyLogs,
    newUsersThisWeek,
    newUsersLastWeek,
    userGrowth:
      newUsersLastWeek > 0
        ? Math.round(((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) * 100)
        : 0,
  }
}

/**
 * Return daily signup counts bucketed over a date range, gap-filled with zeros.
 *
 * Accepts either a plain number of days (backward-compatible):
 *   getUserTrend(30)
 * or an options object (new, configurable):
 *   getUserTrend({ days: 90 })
 *   getUserTrend({ dateFrom: new Date('2026-01-01'), dateTo: new Date('2026-03-31') })
 *
 * When `dateFrom`/`dateTo` are both supplied they take precedence over `days`.
 * Default: last 30 days.
 */
export async function getUserTrend(
  opts: number | { days?: number; dateFrom?: Date; dateTo?: Date } = 30,
): Promise<{ date: string; count: number }[]> {
  const now = Date.now()

  let startDate: Date
  let endDate: Date

  if (typeof opts === 'number') {
    startDate = new Date(now - opts * MS_PER_DAY)
    endDate = new Date(now)
  } else {
    const { days = 30, dateFrom, dateTo } = opts
    if (dateFrom && dateTo) {
      startDate = dateFrom
      endDate = dateTo
    } else if (dateFrom) {
      startDate = dateFrom
      endDate = new Date(now)
    } else if (dateTo) {
      startDate = new Date(dateTo.getTime() - days * MS_PER_DAY)
      endDate = dateTo
    } else {
      startDate = new Date(now - days * MS_PER_DAY)
      endDate = new Date(now)
    }
  }

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Pre-fill every date bucket with zero across the full range
  const dailyCounts: Record<string, number> = {}
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate.getTime() + i * MS_PER_DAY)
    dailyCounts[date.toISOString().split('T')[0]] = 0
  }

  for (const user of users) {
    const dateKey = user.createdAt.toISOString().split('T')[0]
    if (dailyCounts[dateKey] !== undefined) dailyCounts[dateKey]++
  }

  return Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
}

/**
 * Return a histogram of cycle lengths across all profiles.
 */
export async function getCycleLengthDistribution() {
  const profiles = await prisma.profile.findMany({ select: { cycleLength: true } })

  const distribution: Record<number, number> = {}
  for (const p of profiles) {
    distribution[p.cycleLength] = (distribution[p.cycleLength] || 0) + 1
  }

  return Object.entries(distribution)
    .map(([length, count]) => ({ cycleLength: Number(length), count }))
    .sort((a, b) => a.cycleLength - b.cycleLength)
}

/**
 * Return symptom log counts grouped by category.
 */
export async function getSymptomsByCategory() {
  const logs = await prisma.symptomLog.groupBy({
    by: ['category'],
    _count: { id: true },
    where: { symptomId: { not: ALL_GOOD_SYMPTOM_ID } },
  })

  return logs.map(l => ({ category: l.category, count: l._count.id }))
}

/**
 * Return average prediction confidence grouped by tier.
 */
export async function getPredictionAccuracy() {
  const predictions = await prisma.prediction.groupBy({
    by: ['tier'],
    _count: { id: true },
    _avg: { confidence: true },
  })

  return predictions.map(p => ({
    tier: p.tier,
    count: p._count.id,
    avgConfidence: Math.round((p._avg.confidence ?? 0) * 100) / 100,
  }))
}

/**
 * Return weekly cohort retention over the past N weeks (default 8).
 * Each entry contains the cohort week start date, users created that week,
 * users retained (logged in within the last 7 days), and a retention rate.
 */
export async function getUserRetention(weeks: number = 8) {
  const cohorts = []

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(Date.now() - (weeks - i) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [created, retained] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: weekStart, lt: weekEnd }, deletedAt: null },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          deletedAt: null,
          lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    cohorts.push({
      week: weekStart.toISOString().split('T')[0],
      created,
      retained,
      rate: created > 0 ? Math.round((retained / created) * 100) : 0,
    })
  }

  return cohorts
}

// ── Engagement / Logging Analytics ────────────────────────────────────────

/**
 * Return daily distinct-profile logger counts over a date range, gap-filled with zeros.
 *
 * A profile is considered "active" on a day if it has at least one SymptomLog
 * for that date. Accepts the same opts shape as getUserTrend.
 * Default: last 30 days.
 */
export async function getDailyActiveLoggers(
  opts: number | { days?: number; dateFrom?: Date; dateTo?: Date } = 30,
): Promise<{ date: string; count: number }[]> {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const now = Date.now()

  let startDate: Date
  let endDate: Date

  if (typeof opts === 'number') {
    startDate = new Date(now - opts * MS_PER_DAY)
    endDate = new Date(now)
  } else {
    const { days = 30, dateFrom, dateTo } = opts
    if (dateFrom && dateTo) {
      startDate = dateFrom
      endDate = dateTo
    } else if (dateFrom) {
      startDate = dateFrom
      endDate = new Date(now)
    } else if (dateTo) {
      startDate = new Date(dateTo.getTime() - days * MS_PER_DAY)
      endDate = dateTo
    } else {
      startDate = new Date(now - days * MS_PER_DAY)
      endDate = new Date(now)
    }
  }

  // Fetch distinct (profileId, date) pairs in range
  const logs = await prisma.symptomLog.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: { profileId: true, date: true },
    orderBy: { date: 'asc' },
  })

  // Pre-fill every date bucket with zero
  const dailyCounts: Record<string, Set<string>> = {}
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate.getTime() + i * MS_PER_DAY)
    dailyCounts[d.toISOString().split('T')[0]] = new Set()
  }

  for (const log of logs) {
    const dateKey = log.date.toISOString().split('T')[0]
    if (dailyCounts[dateKey]) dailyCounts[dateKey].add(log.profileId)
  }

  return Object.entries(dailyCounts).map(([date, profiles]) => ({
    date,
    count: profiles.size,
  }))
}

/**
 * Return the daily symptom-logging rate (distinct active profiles ÷ total profiles)
 * over a date range, gap-filled with zeros.
 *
 * Rate is 0..1 rounded to 2 decimal places.
 * Accepts the same opts shape as getUserTrend.
 * Default: last 30 days.
 */
export async function getSymptomLoggingRate(
  opts: number | { days?: number; dateFrom?: Date; dateTo?: Date } = 30,
): Promise<{ date: string; rate: number }[]> {
  const [dailyLoggers, totalProfiles] = await Promise.all([
    getDailyActiveLoggers(opts),
    prisma.profile.count(),
  ])

  return dailyLoggers.map(({ date, count }) => ({
    date,
    rate: totalProfiles > 0 ? Math.round((count / totalProfiles) * 100) / 100 : 0,
  }))
}

/**
 * Return a distribution of current consecutive-day logging streaks across all profiles.
 * Buckets (fixed order): '0', '1-2', '3-6', '7-13', '14-29', '30+'
 *
 * A streak day is any day with at least one SymptomLog (including the all_good sentinel).
 * Computes streaks over the last ~40 days in JS (efficient at v1 scale).
 */
export async function getLoggingStreakDistribution(): Promise<
  { bucket: string; count: number }[]
> {
  const LOOK_BACK = 40
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const now = Date.now()
  const since = new Date(now - LOOK_BACK * MS_PER_DAY)

  const today = new Date(new Date().toDateString())

  const logs = await prisma.symptomLog.findMany({
    where: { date: { gte: since } },
    select: { profileId: true, date: true },
  })

  // Build set of active dates per profile
  const profileDates = new Map<string, Set<string>>()
  for (const log of logs) {
    const dateKey = log.date.toISOString().split('T')[0]
    if (!profileDates.has(log.profileId)) profileDates.set(log.profileId, new Set())
    profileDates.get(log.profileId)!.add(dateKey)
  }

  // Compute streak for each profile that has any logs
  const streaks: number[] = []
  for (const [, dates] of profileDates) {
    let streak = 0
    // Start from today or yesterday (whichever has a log) and count back
    let cursor = today.getTime()
    const todayKey = today.toISOString().split('T')[0]
    const yesterdayKey = new Date(today.getTime() - MS_PER_DAY).toISOString().split('T')[0]

    // Only count streak if today or yesterday has a log (active streak)
    if (!dates.has(todayKey) && !dates.has(yesterdayKey)) {
      streaks.push(0)
      continue
    }
    // Start from today
    if (!dates.has(todayKey)) cursor -= MS_PER_DAY

    while (true) {
      const key = new Date(cursor).toISOString().split('T')[0]
      if (dates.has(key)) {
        streak++
        cursor -= MS_PER_DAY
      } else {
        break
      }
    }
    streaks.push(streak)
  }

  // Also include profiles with zero streaks: count all profiles not in profileDates
  const totalProfiles = await prisma.profile.count()
  const profilesWithNoLogs = totalProfiles - profileDates.size
  for (let i = 0; i < profilesWithNoLogs; i++) streaks.push(0)

  // Bucket
  const BUCKETS = ['0', '1-2', '3-6', '7-13', '14-29', '30+']
  const bucketCounts: Record<string, number> = Object.fromEntries(BUCKETS.map(b => [b, 0]))

  function getBucket(s: number): string {
    if (s === 0) return '0'
    if (s <= 2) return '1-2'
    if (s <= 6) return '3-6'
    if (s <= 13) return '7-13'
    if (s <= 29) return '14-29'
    return '30+'
  }

  for (const s of streaks) bucketCounts[getBucket(s)]++

  return BUCKETS.map(bucket => ({ bucket, count: bucketCounts[bucket] }))
}


/**
 * Backtest MAE by prediction tier. Each `series` entry is one profile's period
 * START times in ms. For each profile we walk its cycles: using the cycle
 * lengths observed so far (the same weighted-average the engine uses via
 * predictCycleLength), predict the next start from the previous start, and
 * compare to the actual next start. The tier is the one the engine would have
 * been on given the number of observed cycles (>=6 -> ARIMA, else AVERAGE).
 * Returns one row per tier; maeDays is null when there is no sample.
 */
export function computePredictionMaeByTier(
  series: number[][],
): { tier: 'AVERAGE' | 'ARIMA'; maeDays: number | null; sampleSize: number }[] {
  const buckets = { AVERAGE: { sum: 0, n: 0 }, ARIMA: { sum: 0, n: 0 } }

  for (const raw of series) {
    const s = [...raw].sort((a, b) => a - b)
    const n = s.length
    if (n < 3) continue // need >=1 observed cycle length AND a following actual

    // Observed cycle lengths c[k] = round(days between s[k] and s[k+1]).
    const c: number[] = []
    for (let k = 1; k < n; k++) c.push(Math.round((s[k] - s[k - 1]) / MS_PER_DAY))

    // Predict s[j] (j >= 2) from history c[0..j-2] (length j-1 >= 1).
    for (let j = 2; j < n; j++) {
      const history = c.slice(0, j - 1)
      const predictedLen = predictCycleLength(history, 28)
      const predictedStart = s[j - 1] + predictedLen * MS_PER_DAY
      const errDays = Math.round(Math.abs(predictedStart - s[j]) / MS_PER_DAY)
      const tier = getPredictionTier(history.length) === 'arima' ? 'ARIMA' : 'AVERAGE'
      buckets[tier].sum += errDays
      buckets[tier].n += 1
    }
  }

  return (['AVERAGE', 'ARIMA'] as const).map((tier) => ({
    tier,
    maeDays: buckets[tier].n > 0 ? Math.round((buckets[tier].sum / buckets[tier].n) * 10) / 10 : null,
    sampleSize: buckets[tier].n,
  }))
}

/** On-demand per-tier prediction MAE (days), backtested from period-log history. */
export async function getPredictionAccuracyMae() {
  const logs = await prisma.periodLog.findMany({
    select: { profileId: true, startDate: true },
    orderBy: [{ profileId: 'asc' }, { startDate: 'asc' }],
  })
  const byProfile = new Map<string, number[]>()
  for (const l of logs) {
    const arr = byProfile.get(l.profileId) ?? []
    arr.push(l.startDate.getTime())
    byProfile.set(l.profileId, arr)
  }
  return computePredictionMaeByTier([...byProfile.values()])
}

/**
 * Return weekly cohort logging retention over the past N weeks (default 8).
 *
 * Cohort = profiles whose first SymptomLog falls in the cohort week.
 * "Retained" = that profile also has a SymptomLog in a subsequent week
 * (specifically the most recent completed week before now).
 * Mirrors getUserRetention but cohorting by first log rather than account creation.
 */
export async function getLoggingRetention(
  weeks: number = 8,
): Promise<{ week: string; created: number; retained: number; rate: number }[]> {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
  const retentionWindowStart = new Date(Date.now() - MS_PER_WEEK)
  const cohorts = []

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(Date.now() - (weeks - i) * MS_PER_WEEK)
    const weekEnd = new Date(weekStart.getTime() + MS_PER_WEEK)

    // Profiles whose first SymptomLog is in this cohort week
    const cohortProfiles = await prisma.symptomLog.groupBy({
      by: ['profileId'],
      _min: { date: true },
      having: {
        date: { _min: { gte: weekStart, lt: weekEnd } },
      },
    })

    const created = cohortProfiles.length
    const cohortIds = cohortProfiles.map(p => p.profileId)

    let retained = 0
    if (cohortIds.length > 0) {
      const retainedProfiles = await prisma.symptomLog.findMany({
        where: {
          profileId: { in: cohortIds },
          date: { gte: retentionWindowStart },
        },
        select: { profileId: true },
        distinct: ['profileId'],
      })
      retained = retainedProfiles.length
    }

    cohorts.push({
      week: weekStart.toISOString().split('T')[0],
      created,
      retained,
      rate: created > 0 ? Math.round((retained / created) * 100) : 0,
    })
  }

  return cohorts
}

// ── Symptoms by Cycle Phase ────────────────────────────────────────────────

/**
 * Resolve the cycle phase a symptom log falls in: find the most recent period
 * start at/before the log, derive the cycle day, and map to a phase. Returns
 * null when there is no preceding period start to anchor the cycle.
 */
export function phaseForLog(
  logMs: number,
  periodStartsMsAsc: number[],
  cycleLength: number,
  periodLength: number,
): 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | null {
  let start: number | null = null
  for (const s of periodStartsMsAsc) {
    if (s <= logMs) start = s
    else break
  }
  if (start === null) return null
  const cycleDay = Math.min(Math.floor((logMs - start) / MS_PER_DAY) + 1, cycleLength)
  return getCurrentPhase(cycleDay, periodLength, cycleLength)
}

/** Count symptom logs by the cycle phase they fall in (population-wide). */
export async function getSymptomsByPhase(): Promise<{ phase: string; count: number }[]> {
  const [profiles, periodLogs, symptomLogs] = await Promise.all([
    prisma.profile.findMany({ select: { id: true, cycleLength: true, periodLength: true } }),
    prisma.periodLog.findMany({
      select: { profileId: true, startDate: true },
      orderBy: [{ profileId: 'asc' }, { startDate: 'asc' }],
    }),
    prisma.symptomLog.findMany({ select: { profileId: true, date: true } }),
  ])

  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const startsByProfile = new Map<string, number[]>()
  for (const l of periodLogs) {
    const arr = startsByProfile.get(l.profileId) ?? []
    arr.push(l.startDate.getTime())
    startsByProfile.set(l.profileId, arr)
  }

  const counts: Record<string, number> = { MENSTRUAL: 0, FOLLICULAR: 0, OVULATION: 0, LUTEAL: 0 }
  for (const log of symptomLogs) {
    const prof = profileMap.get(log.profileId)
    const starts = startsByProfile.get(log.profileId)
    if (!prof || !starts) continue
    const phase = phaseForLog(
      new Date(log.date).getTime(),
      starts,
      prof.cycleLength ?? 28,
      prof.periodLength ?? 5,
    )
    if (!phase) continue
    counts[phase.toUpperCase()] += 1
  }

  return (['MENSTRUAL', 'FOLLICULAR', 'OVULATION', 'LUTEAL'] as const).map((phase) => ({
    phase,
    count: counts[phase],
  }))
}
