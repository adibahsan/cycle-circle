import { prisma } from '../db'
import { countProUsers } from './churn-service'
import { ALL_GOOD_SYMPTOM_ID } from '../../utils/symptoms'
import { predictCycleLength, getPredictionTier, getCurrentPhase, MS_PER_DAY } from '../../utils/cycle-utils'
import { fillDaySeries, resolveDaySeriesRange } from '../../utils/day-series'
import type { DateRange } from '../../utils/date-range'
import {
  addDaysToDay,
  bangladeshDayOf,
  bangladeshToday,
  dayToStoredDate,
  parseDhakaDay,
  storedDateToDay,
} from '../../utils/dhaka-date'

type SeriesOpts = number | DateRange | { days?: number; dateFrom?: Date; dateTo?: Date }

/**
 * The Bangladesh days a per-day series covers; `days` counts the last N days ending today, inclusive.
 * A shared `DateRange` (see utils/date-range) gives exactly its days.
 */
function seriesDays(opts: SeriesOpts, now: Date) {
  const o =
    typeof opts === 'number'
      ? { days: opts }
      : 'fromDay' in opts
        ? { dateFrom: opts.from, dateTo: opts.to }
        : opts
  const { fromDay, toDay, from, to } = resolveDaySeriesRange({ ...o, now })
  const list = fillDaySeries(fromDay, toDay, new Map()).map((r) => r.date)
  return { startDay: fromDay, endDay: toDay, from, to, list }
}

/** Symptom logs plus period logs created since the start of the Bangladesh day `now` falls on. */
async function countLogsToday(now: Date): Promise<number> {
  const createdAt = { gte: parseDhakaDay(bangladeshToday(now)), lte: now }
  const [symptoms, periods] = await Promise.all([
    prisma.symptomLog.count({ where: { createdAt } }),
    prisma.periodLog.count({ where: { createdAt } }),
  ])
  return symptoms + periods
}

/**
 * Return KPI counts for the admin dashboard.
 * `totalProfiles` leaves out deleted users' profiles, `dailyLogs` is symptom plus period logs
 * created today (Bangladesh), and `proSubscribers` is countProUsers().
 */
export async function getDashboardStats(now: Date) {
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
    prisma.profile.count({ where: { user: { deletedAt: null } } }),
    countProUsers(),
    countLogsToday(now),
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
 *   getUserTrend(30, now)
 * or an options object (new, configurable):
 *   getUserTrend({ days: 90 }, now)
 *   getUserTrend({ dateFrom, dateTo }, now)  // Asia/Dhaka day bounds, see parseDhakaDay
 *
 * When `dateFrom`/`dateTo` are both supplied they take precedence over `days`.
 * Default: last 30 days.
 */
export async function getUserTrend(
  opts: SeriesOpts,
  now: Date,
): Promise<{ date: string; count: number }[]> {
  const { from, to, list } = seriesDays(opts, now)

  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: from, lte: to }, // a signup stays a signup if the user is deleted later
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Pre-fill every Bangladesh day with zero, then bucket each signup by its Bangladesh day.
  const dailyCounts: Record<string, number> = Object.fromEntries(list.map((d) => [d, 0]))
  for (const user of users) {
    const dateKey = bangladeshDayOf(user.createdAt)
    if (dailyCounts[dateKey] !== undefined) dailyCounts[dateKey]++
  }

  return list.map((date) => ({ date, count: dailyCounts[date] }))
}

/**
 * Date window every analytics panel query takes. A shared `DateRange` (utils/date-range) fits:
 * `from` starts its first Bangladesh day and `to` is the last millisecond of its last.
 */
export type AnalyticsRange = Pick<DateRange, 'from' | 'to'>

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
  // The database pairs each period start with the previous one (per profile) and counts the
  // plausible gaps, so only the histogram comes back.
  const rows = await prisma.$queryRaw<{ days: number; count: number }[]>`
    SELECT g.days::int AS days, COUNT(*)::int AS count
    FROM (
      SELECT pl."startDate" AS "startDate",
             ROUND((EXTRACT(EPOCH FROM (pl."startDate" - LAG(pl."startDate") OVER (PARTITION BY pl."profileId" ORDER BY pl."startDate")))
               / 86400)::numeric) AS days
      FROM "PeriodLog" pl
      JOIN "Profile" p ON p."id" = pl."profileId"
      JOIN "User" u ON u."id" = p."userId"
      WHERE u."deletedAt" IS NULL AND pl."startDate" <= ${to.toISOString()}::timestamp
    ) g
    WHERE g.days BETWEEN ${PLAUSIBLE_CYCLE_MIN_DAYS} AND ${PLAUSIBLE_CYCLE_MAX_DAYS}
      AND g."startDate" >= ${from.toISOString()}::timestamp
    GROUP BY g.days
    ORDER BY g.days
  `
  return rows.map((r) => ({ cycleLength: Number(r.days), count: Number(r.count) }))
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
      profile: { user: { deletedAt: null } },
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
    where: { profile: { user: { deletedAt: null } }, ...(range ? { updatedAt: { gte: range.from, lte: range.to } } : {}) },
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
  { maxWeeks = 8, now }: { maxWeeks?: number; now: Date },
): Promise<RetentionCohort[]> {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()
  // Both queries run in the database and return one row per cohort (and week), not per log.
  const [sizes, activity] = await Promise.all([
    prisma.$queryRaw<{ c: number; size: number }[]>`
      SELECT FLOOR(EXTRACT(EPOCH FROM (u."createdAt" - ${fromIso}::timestamp)) / 604800)::int AS c, COUNT(*)::int AS size
      FROM "User" u
      WHERE u."deletedAt" IS NULL AND u."createdAt" >= ${fromIso}::timestamp AND u."createdAt" <= ${toIso}::timestamp
      GROUP BY 1
    `,
    prisma.$queryRaw<{ c: number; k: number; active: number }[]>`
      WITH cohort AS (
        SELECT u."id", u."createdAt",
               FLOOR(EXTRACT(EPOCH FROM (u."createdAt" - ${fromIso}::timestamp)) / 604800)::int AS c
        FROM "User" u
        WHERE u."deletedAt" IS NULL AND u."createdAt" >= ${fromIso}::timestamp AND u."createdAt" <= ${toIso}::timestamp
      ),
      logs AS (
        SELECT p."userId" AS uid, l."createdAt" AS at
        FROM "SymptomLog" l JOIN "Profile" p ON p."id" = l."profileId"
        WHERE p."userId" IN (SELECT "id" FROM cohort)
        UNION ALL
        SELECT p."userId", l."createdAt"
        FROM "PeriodLog" l JOIN "Profile" p ON p."id" = l."profileId"
        WHERE p."userId" IN (SELECT "id" FROM cohort)
      )
      SELECT w.c, w.k, COUNT(DISTINCT w.id)::int AS active
      FROM (
        SELECT cohort."id", cohort.c,
               FLOOR(EXTRACT(EPOCH FROM (logs.at - cohort."createdAt")) / 604800)::int AS k
        FROM cohort JOIN logs ON logs.uid = cohort."id"
      ) w
      WHERE w.k >= 0 AND w.k < ${maxWeeks}
      GROUP BY w.c, w.k
    `,
  ])

  const activeBy = new Map(activity.map((a) => [`${a.c}:${a.k}`, Number(a.active)]))
  return sizes
    .map((s) => ({ c: Number(s.c), size: Number(s.size) }))
    .sort((a, b) => a.c - b.c)
    .map(({ c, size }) => {
      const cohortEndMs = from.getTime() + (c + 1) * MS_PER_WEEK
      const weeks: RetentionCohort['weeks'] = []
      for (let k = 0; k < maxWeeks; k++) {
        // Skip weeks that haven't fully elapsed for the whole cohort yet.
        if (cohortEndMs + (k + 1) * MS_PER_WEEK > now.getTime()) break
        const active = activeBy.get(`${c}:${k}`) ?? 0
        weeks.push({ week: k, active, rate: Math.round((active / size) * 100) })
      }
      return {
        cohortWeek: new Date(from.getTime() + c * MS_PER_WEEK).toISOString().split('T')[0],
        size,
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
  opts: SeriesOpts,
  now: Date,
): Promise<{ date: string; count: number }[]> {
  const { startDay, endDay, list } = seriesDays(opts, now)

  // Symptom log dates are stored as UTC midnight of their calendar day; deleted users' profiles don't count.
  const rows = await prisma.$queryRaw<{ date: string; count: number }[]>`
    SELECT TO_CHAR(s."date", 'YYYY-MM-DD') AS date, COUNT(DISTINCT s."profileId")::int AS count
    FROM "SymptomLog" s
    JOIN "Profile" p ON p."id" = s."profileId"
    JOIN "User" u ON u."id" = p."userId"
    WHERE u."deletedAt" IS NULL
      AND s."date" >= ${dayToStoredDate(startDay).toISOString()}::timestamp
      AND s."date" <= ${dayToStoredDate(endDay).toISOString()}::timestamp
    GROUP BY 1
  `
  const counts = new Map(rows.map((r) => [r.date, Number(r.count)]))
  return list.map((date) => ({ date, count: counts.get(date) ?? 0 }))
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
  opts: SeriesOpts,
  now: Date,
): Promise<{ date: string; rate: number }[]> {
  const [dailyLoggers, totalProfiles] = await Promise.all([
    getDailyActiveLoggers(opts, now),
    prisma.profile.count({ where: { user: { deletedAt: null } } }),
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
export async function getLoggingStreakDistribution(
  range: Pick<DateRange, 'toDay'>,
  now: Date,
): Promise<{ bucket: string; count: number }[]> {
  const LOOK_BACK = 40
  // Streaks are measured as of the range's last day (never later than the Bangladesh today).
  const todayBd = bangladeshToday(now)
  const today = range.toDay < todayBd ? range.toDay : todayBd
  const yesterday = addDaysToDay(today, -1)

  // Symptom log dates are stored as UTC midnight of their calendar day.
  const logs = await prisma.symptomLog.findMany({
    where: {
      date: { gte: dayToStoredDate(addDaysToDay(today, -LOOK_BACK)), lte: dayToStoredDate(today) },
      profile: { user: { deletedAt: null } },
    },
    select: { profileId: true, date: true },
  })

  // Build set of active days per profile
  const profileDates = new Map<string, Set<string>>()
  for (const log of logs) {
    if (!profileDates.has(log.profileId)) profileDates.set(log.profileId, new Set())
    profileDates.get(log.profileId)!.add(storedDateToDay(log.date))
  }

  // Compute streak for each profile that has any logs
  const streaks: number[] = []
  for (const [, dates] of profileDates) {
    // Only count streak if today or yesterday has a log (active streak)
    if (!dates.has(today) && !dates.has(yesterday)) {
      streaks.push(0)
      continue
    }
    let streak = 0
    let cursor = dates.has(today) ? today : yesterday
    while (dates.has(cursor)) {
      streak++
      cursor = addDaysToDay(cursor, -1)
    }
    streaks.push(streak)
  }

  // Also include profiles with zero streaks: count all profiles not in profileDates
  const totalProfiles = await prisma.profile.count({ where: { user: { deletedAt: null } } })
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
export async function snapshotPredictionAccuracy(now: Date) {
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
  // Snapshots are labelled by day: the range's first and last Bangladesh days bound them inclusively.
  const rows = await prisma.predictionAccuracySnapshot.findMany({
    where: { date: { gte: dayToStoredDate(bangladeshDayOf(from)), lte: dayToStoredDate(bangladeshDayOf(to)) } },
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
 * Weekly logging retention, measured per cohort.
 *
 * Cohort = live users' profiles whose first SymptomLog falls in a 7-day block (Bangladesh days,
 * `ceil(days / 7)` blocks ending on the range's last day, never past today). A cohort is
 * "retained" when the profile logs again in the block right after its own cohort block.
 * That following block must have fully elapsed; until then `retained` and `rate` are null,
 * so the newest cohorts are never reported as 100% by construction.
 */
export async function getLoggingRetention(
  range: Pick<DateRange, 'days' | 'toDay'>,
  now: Date,
): Promise<{ week: string; created: number; retained: number | null; rate: number | null }[]> {
  const weeks = Math.min(Math.max(Math.ceil(range.days / 7), 1), 53)
  const today = bangladeshToday(now)
  const endDay = range.toDay < today ? range.toDay : today
  const startDay = addDaysToDay(endDay, -(weeks * 7 - 1))
  const startIso = dayToStoredDate(startDay).toISOString()
  const endIso = dayToStoredDate(addDaysToDay(endDay, 1)).toISOString()

  const rows = await prisma.$queryRaw<{ idx: number; created: number; retained: number }[]>`
    SELECT c.idx::int AS idx, COUNT(*)::int AS created,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM "SymptomLog" s2
             WHERE s2."profileId" = c."profileId"
               AND s2."date" >= ${startIso}::timestamp + (c.idx + 1) * 7 * interval '1 day'
               AND s2."date" <  ${startIso}::timestamp + (c.idx + 2) * 7 * interval '1 day'
           ))::int AS retained
    FROM (
      SELECT s."profileId",
             FLOOR(EXTRACT(EPOCH FROM (MIN(s."date") - ${startIso}::timestamp)) / 604800)::int AS idx
      FROM "SymptomLog" s
      JOIN "Profile" p ON p."id" = s."profileId"
      JOIN "User" u ON u."id" = p."userId"
      WHERE u."deletedAt" IS NULL
      GROUP BY s."profileId"
      HAVING MIN(s."date") >= ${startIso}::timestamp AND MIN(s."date") < ${endIso}::timestamp
    ) c
    GROUP BY c.idx
  `
  const byIdx = new Map(rows.map((r) => [Number(r.idx), r]))

  return Array.from({ length: weeks }, (_, i) => {
    const row = byIdx.get(i)
    const created = row ? Number(row.created) : 0
    // The block after cohort i is [start + (i+1)*7, start + (i+2)*7); it must end before today.
    const followingEnd = addDaysToDay(startDay, (i + 2) * 7 - 1)
    const measured = followingEnd < today
    const retained = measured ? (row ? Number(row.retained) : 0) : null
    return {
      week: addDaysToDay(startDay, i * 7),
      created,
      retained,
      rate: retained === null ? null : created > 0 ? Math.round((retained / created) * 100) : 0,
    }
  })
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
  // The database places each log in the period interval (start up to the next start) it falls in and returns counts per
  // (symptom, profile cycle settings, days since that start), never the logs themselves.
  const rows = await prisma.$queryRaw<
    { symptomId: string; cycleLength: number; periodLength: number; sinceStart: number; count: number }[]
  >`
    SELECT s."symptomId", p."cycleLength", p."periodLength",
           FLOOR(EXTRACT(EPOCH FROM (s."date" - i."start")) / 86400)::int AS "sinceStart",
           COUNT(*)::int AS count
    FROM (
      SELECT pl."profileId", pl."startDate" AS "start",
             LEAD(pl."startDate") OVER (PARTITION BY pl."profileId" ORDER BY pl."startDate") AS "next"
      FROM "PeriodLog" pl
    ) i
    JOIN "Profile" p ON p."id" = i."profileId"
    JOIN "User" u ON u."id" = p."userId"
    JOIN "SymptomLog" s ON s."profileId" = i."profileId"
      AND s."date" >= i."start" AND (i."next" IS NULL OR s."date" < i."next")
    WHERE u."deletedAt" IS NULL
      AND s."symptomId" <> ${ALL_GOOD_SYMPTOM_ID}
      AND s."date" >= ${from.toISOString()}::timestamp AND s."date" <= ${to.toISOString()}::timestamp
    GROUP BY 1, 2, 3, 4
  `

  const phases = ['MENSTRUAL', 'FOLLICULAR', 'OVULATION', 'LUTEAL'] as const
  const counts = new Map<string, Map<string, number>>(phases.map((p) => [p, new Map()]))
  for (const r of rows) {
    // A single period start at 0 ms: phaseForLog derives the cycle day from the gap alone.
    const phase = phaseForLog(Number(r.sinceStart) * MS_PER_DAY, [0], r.cycleLength ?? 28, r.periodLength ?? 5)
    if (!phase) continue
    const m = counts.get(phase.toUpperCase())!
    m.set(r.symptomId, (m.get(r.symptomId) ?? 0) + Number(r.count))
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
