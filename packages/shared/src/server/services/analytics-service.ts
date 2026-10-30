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
    // eslint-disable-next-line no-restricted-syntax -- Bangladesh-day debt, see https://github.com/adibahsan/cycle-circle/issues/147
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
    generatedAt: now.toISOString(),
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

/** Date window every analytics panel query takes; #103 adds metric/config fields. */
export interface AnalyticsRange {
  from: Date
  to: Date
}

/** Measured gaps outside this many days are treated as missed logs, not real cycles. */
export const PLAUSIBLE_CYCLE_MIN_DAYS = 15
export const PLAUSIBLE_CYCLE_MAX_DAYS = 90

/**
 * Whole-day gaps between consecutive period starts (ascending ms) that fall
 * in the plausible range. Each gap is attributed to the later start's time.
 */
export function measuredCycleGaps(
  startsMsAsc: number[],
): { endMs: number; days: number }[] {
  const gaps: { endMs: number; days: number }[] = []
  for (let i = 1; i < startsMsAsc.length; i++) {
    const days = Math.round((startsMsAsc[i] - startsMsAsc[i - 1]) / MS_PER_DAY)
    if (days >= PLAUSIBLE_CYCLE_MIN_DAYS && days <= PLAUSIBLE_CYCLE_MAX_DAYS) {
      gaps.push({ endMs: startsMsAsc[i], days })
    }
  }
  return gaps
}

/**
 * Histogram of measured cycle lengths: gaps between consecutive logged period
 * starts per profile (implausible gaps excluded), not the length users typed in.
 * A cycle counts when the later period start falls in [from, to]. Aggregate only.
 */
export async function getCycleLengthDistribution({ from, to }: AnalyticsRange) {
  const logs = await prisma.periodLog.findMany({
    where: { startDate: { lte: to } },
    select: { profileId: true, startDate: true },
    orderBy: [{ profileId: 'asc' }, { startDate: 'asc' }],
  })

  const startsByProfile = new Map<string, number[]>()
  for (const l of logs) {
    const arr = startsByProfile.get(l.profileId) ?? []
    arr.push(l.startDate.getTime())
    startsByProfile.set(l.profileId, arr)
  }

  const distribution = new Map<number, number>()
  for (const starts of startsByProfile.values()) {
    for (const g of measuredCycleGaps(starts)) {
      if (g.endMs < from.getTime()) continue
      distribution.set(g.days, (distribution.get(g.days) ?? 0) + 1)
    }
  }

  return [...distribution.entries()]
    .map(([cycleLength, count]) => ({ cycleLength, count }))
    .sort((a, b) => a.cycleLength - b.cycleLength)
}

/**
 * Return symptom log counts grouped by category. With a range, only logs dated
 * inside [from, to] count; without one, all history.
 */
export async function getSymptomsByCategory(range?: AnalyticsRange) {
  const logs = await prisma.symptomLog.groupBy({
    by: ['category'],
    _count: { id: true },
    where: {
      symptomId: { not: ALL_GOOD_SYMPTOM_ID },
      ...(range ? { date: { gte: range.from, lte: range.to } } : {}),
    },
  })

  return logs.map(l => ({ category: l.category, count: l._count.id }))
}

/**
 * Return average prediction confidence grouped by tier. With a range, only
 * predictions (re)computed inside [from, to] count; without one, all of them.
 */
export async function getPredictionAccuracy(range?: AnalyticsRange) {
  const predictions = await prisma.prediction.groupBy({
    by: ['tier'],
    ...(range ? { where: { updatedAt: { gte: range.from, lte: range.to } } } : {}),
    _count: { id: true },
    _avg: { confidence: true },
  })

  return predictions.map(p => ({
    tier: p.tier,
    count: p._count.id,
    avgConfidence: Math.round((p._avg.confidence ?? 0) * 100) / 100,
  }))
}

const MS_PER_WEEK = 7 * MS_PER_DAY

export interface RetentionCohort {
  /** Start (YYYY-MM-DD, UTC) of the 7-day signup cohort. */
  cohortWeek: string
  size: number
  /** Share of the cohort active in week k after signup; only fully elapsed weeks. */
  weeks: { week: number; active: number; rate: number }[]
}

/**
 * Weekly signup-cohort retention curve. Cohorts are consecutive 7-day buckets
 * starting at `from` (users created in [from, to], not deleted). A user is
 * active in week k when any of their profiles has a symptom or period log
 * created during days [7k, 7k+7) after their signup. Aggregate only: no ids.
 */
export async function getUserRetention(
  { from, to }: AnalyticsRange,
  { maxWeeks = 8, now = new Date() }: { maxWeeks?: number; now?: Date } = {},
): Promise<RetentionCohort[]> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, createdAt: { gte: from, lte: to } },
    select: { id: true, createdAt: true },
  })
  if (users.length === 0) return []

  const userIds = users.map((u) => u.id)
  const [symptom, period] = await Promise.all([
    prisma.symptomLog.findMany({
      where: { profile: { userId: { in: userIds } } },
      select: { createdAt: true, profile: { select: { userId: true } } },
    }),
    prisma.periodLog.findMany({
      where: { profile: { userId: { in: userIds } } },
      select: { createdAt: true, profile: { select: { userId: true } } },
    }),
  ])

  const createdMs = new Map(users.map((u) => [u.id, u.createdAt.getTime()]))
  // userId -> set of week offsets in which the user was active
  const activeWeeks = new Map<string, Set<number>>()
  for (const l of [...symptom, ...period]) {
    const uid = l.profile.userId
    const k = Math.floor((l.createdAt.getTime() - createdMs.get(uid)!) / MS_PER_WEEK)
    if (k < 0 || k >= maxWeeks) continue
    const set = activeWeeks.get(uid) ?? new Set<number>()
    set.add(k)
    activeWeeks.set(uid, set)
  }

  const cohortMembers = new Map<number, string[]>()
  for (const u of users) {
    const c = Math.floor((u.createdAt.getTime() - from.getTime()) / MS_PER_WEEK)
    const arr = cohortMembers.get(c) ?? []
    arr.push(u.id)
    cohortMembers.set(c, arr)
  }

  return [...cohortMembers.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([c, members]) => {
      const cohortEndMs = from.getTime() + (c + 1) * MS_PER_WEEK
      const weeks: RetentionCohort['weeks'] = []
      for (let k = 0; k < maxWeeks; k++) {
        // Skip weeks that haven't fully elapsed for the whole cohort yet.
        if (cohortEndMs + (k + 1) * MS_PER_WEEK > now.getTime()) break
        const active = members.filter((id) => activeWeeks.get(id)?.has(k)).length
        weeks.push({ week: k, active, rate: Math.round((active / members.length) * 100) })
      }
      return {
        cohortWeek: new Date(from.getTime() + c * MS_PER_WEEK).toISOString().split('T')[0],
        size: members.length,
        weeks,
      }
    })
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

  // eslint-disable-next-line no-restricted-syntax -- Bangladesh-day debt, see https://github.com/adibahsan/cycle-circle/issues/147
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

export type PredictionMaeTier = {
  tier: 'AVERAGE' | 'ARIMA'
  maeDays: number | null
  sampleSize: number
}

const MAE_TIERS = ['AVERAGE', 'ARIMA'] as const

/** UTC calendar day a nightly snapshot belongs to. */
function snapshotDay(d: Date): Date {
  return new Date(d.toISOString().slice(0, 10))
}

/** Upsert one snapshot row per tier for the given night (re-runs overwrite). */
export async function writePredictionSnapshot(now: Date, tiers: PredictionMaeTier[]) {
  const date = snapshotDay(now)
  for (const t of tiers) {
    const data = { maeDays: t.maeDays, sampleSize: t.sampleSize, computedAt: now }
    await prisma.predictionAccuracySnapshot.upsert({
      where: { date_tier: { date, tier: t.tier } },
      create: { date, tier: t.tier, ...data },
      update: data,
    })
  }
}

/** Backtest now and store tonight's snapshot (nightly maintenance job). */
export async function snapshotPredictionAccuracy(now: Date = new Date()) {
  const tiers = await getPredictionAccuracyMae()
  await writePredictionSnapshot(now, tiers)
  return tiers
}

/**
 * Latest per-tier prediction MAE for the admin dashboard and analytics, read
 * from the most recent nightly snapshot. `computedAt` is null before the first
 * snapshot exists.
 */
export async function getLatestPredictionMae(): Promise<{
  tiers: PredictionMaeTier[]
  computedAt: string | null
}> {
  const latest = await prisma.predictionAccuracySnapshot.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  })
  const rows = latest
    ? await prisma.predictionAccuracySnapshot.findMany({ where: { date: latest.date } })
    : []
  const tiers = MAE_TIERS.map((tier) => {
    const r = rows.find((x) => x.tier === tier)
    return { tier, maeDays: r?.maeDays ?? null, sampleSize: r?.sampleSize ?? 0 }
  })
  const computedAt = rows.reduce<Date | null>(
    (m, r) => (!m || r.computedAt > m ? r.computedAt : m),
    null,
  )
  return { tiers, computedAt: computedAt ? computedAt.toISOString() : null }
}

/** Snapshot history for the analytics trend: one point per tier per night, oldest first. */
export async function getPredictionMaeTrend({ from, to }: AnalyticsRange) {
  const rows = await prisma.predictionAccuracySnapshot.findMany({
    where: { date: { gte: snapshotDay(from), lte: snapshotDay(to) } },
    orderBy: [{ date: 'asc' }, { tier: 'asc' }],
  })
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    tier: r.tier as PredictionMaeTier['tier'],
    maeDays: r.maeDays,
    sampleSize: r.sampleSize,
  }))
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

export interface PhaseSymptoms {
  phase: 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL'
  /** All symptom logs in the phase (excluding "all good"). */
  total: number
  top: { symptomId: string; count: number }[]
}

/**
 * Most common symptom types per cycle phase (top N, "all good" excluded) for
 * symptom logs dated in [from, to], phase anchored to each profile's period
 * history. Aggregate only.
 */
export async function getSymptomsByPhase(
  { from, to }: AnalyticsRange,
  { topN = 5 }: { topN?: number } = {},
): Promise<PhaseSymptoms[]> {
  const symptomLogs = await prisma.symptomLog.findMany({
    where: { date: { gte: from, lte: to }, symptomId: { not: ALL_GOOD_SYMPTOM_ID } },
    select: { profileId: true, date: true, symptomId: true },
  })
  const profileIds = [...new Set(symptomLogs.map((l) => l.profileId))]
  const [profiles, periodLogs] = await Promise.all([
    prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, cycleLength: true, periodLength: true },
    }),
    prisma.periodLog.findMany({
      where: { profileId: { in: profileIds } },
      select: { profileId: true, startDate: true },
      orderBy: [{ profileId: 'asc' }, { startDate: 'asc' }],
    }),
  ])

  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const startsByProfile = new Map<string, number[]>()
  for (const l of periodLogs) {
    const arr = startsByProfile.get(l.profileId) ?? []
    arr.push(l.startDate.getTime())
    startsByProfile.set(l.profileId, arr)
  }

  const phases = ['MENSTRUAL', 'FOLLICULAR', 'OVULATION', 'LUTEAL'] as const
  const counts = new Map<string, Map<string, number>>(phases.map((p) => [p, new Map()]))
  for (const log of symptomLogs) {
    const prof = profileMap.get(log.profileId)
    const starts = startsByProfile.get(log.profileId)
    if (!prof || !starts) continue
    const phase = phaseForLog(
      log.date.getTime(),
      starts,
      prof.cycleLength ?? 28,
      prof.periodLength ?? 5,
    )
    if (!phase) continue
    const m = counts.get(phase.toUpperCase())!
    m.set(log.symptomId, (m.get(log.symptomId) ?? 0) + 1)
  }

  return phases.map((phase) => {
    const m = counts.get(phase)!
    const sorted = [...m.entries()]
      .map(([symptomId, count]) => ({ symptomId, count }))
      .sort((a, b) => b.count - a.count || a.symptomId.localeCompare(b.symptomId))
    return {
      phase,
      total: sorted.reduce((n, x) => n + x.count, 0),
      top: sorted.slice(0, topN),
    }
  })
}
