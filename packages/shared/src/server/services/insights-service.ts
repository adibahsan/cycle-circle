import { differenceInDays, addDays, format } from 'date-fns'
import { prisma } from '../db'
import { assertProfileOwnership } from './profile-service'
import { ALL_GOOD_SYMPTOM_ID } from '../../utils/symptoms'
import { getCurrentPhase, MS_PER_DAY } from '../../utils/cycle-utils'
import type { CyclePhase } from '../../types/types'

// ─── Return-shape interfaces ───────────────────────────────────────────────────

export interface CycleLengthPoint {
  /** YYYY-MM-DD — the startDate of the later period log that closes the cycle */
  date: string
  cycleLength: number
}

export interface SymptomFrequencyPoint {
  category: string
  count: number
}

export interface PeriodRegularity {
  mean: number
  stdDev: number
  regular: boolean
  sampleSize: number
}

export interface FertileWindowPoint {
  cycleStart: string
  fertileStart: string
  fertileEnd: string
  ovulationDay: string
}

// ─── Shared option type ────────────────────────────────────────────────────────

export interface InsightsRangeOpts {
  dateFrom?: Date
  dateTo?: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/**
 * Compute cycle lengths from a sorted list of period-start dates.
 * Returns an array of { date, cycleLength } pairs where `date` is the
 * startDate of the *later* log and `cycleLength` is the day gap.
 */
function computeCycleLengths(sortedStarts: Date[]): CycleLengthPoint[] {
  const result: CycleLengthPoint[] = []
  for (let i = 1; i < sortedStarts.length; i++) {
    const gap = differenceInDays(sortedStarts[i], sortedStarts[i - 1])
    if (gap > 0) {
      result.push({ date: toYMD(sortedStarts[i]), cycleLength: gap })
    }
  }
  return result
}

// ─── 1. getCycleLengthTrend ────────────────────────────────────────────────────

/**
 * Returns the cycle lengths computed from consecutive PeriodLog startDates.
 * Each point's `date` is the YYYY-MM-DD of the *later* period start.
 * Returns [] when fewer than 2 logs exist (or within the applied range).
 */
export async function getCycleLengthTrend(
  profileId: string,
  userId: string,
  opts?: InsightsRangeOpts,
): Promise<CycleLengthPoint[]> {
  await assertProfileOwnership(profileId, userId)

  const where: {
    profileId: string
    startDate?: { gte?: Date; lte?: Date }
  } = { profileId }

  if (opts?.dateFrom || opts?.dateTo) {
    where.startDate = {}
    if (opts.dateFrom) where.startDate.gte = opts.dateFrom
    if (opts.dateTo) where.startDate.lte = opts.dateTo
  }

  const logs = await prisma.periodLog.findMany({
    where,
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  })

  if (logs.length < 2) return []

  const starts = logs.map((l) => l.startDate)
  return computeCycleLengths(starts)
}

// ─── 2. getSymptomFrequency ────────────────────────────────────────────────────

const ALL_SYMPTOM_CATEGORIES = ['PHYSICAL', 'MOOD', 'DISCHARGE', 'LIFESTYLE'] as const

/**
 * Counts SymptomLogs grouped by category over an optional date range.
 * All four categories are always included; missing ones report count 0.
 */
export async function getSymptomFrequency(
  profileId: string,
  userId: string,
  opts?: InsightsRangeOpts,
): Promise<SymptomFrequencyPoint[]> {
  await assertProfileOwnership(profileId, userId)

  const where: {
    profileId: string
    date?: { gte?: Date; lte?: Date }
  } = { profileId }

  if (opts?.dateFrom || opts?.dateTo) {
    where.date = {}
    if (opts.dateFrom) where.date.gte = opts.dateFrom
    if (opts.dateTo) where.date.lte = opts.dateTo
  }

  const groups = await prisma.symptomLog.groupBy({
    by: ['category'],
    where: { ...where, symptomId: { not: ALL_GOOD_SYMPTOM_ID } },
    _count: { category: true },
  })

  const countMap = new Map<string, number>()
  for (const g of groups) {
    countMap.set(g.category, g._count.category)
  }

  return ALL_SYMPTOM_CATEGORIES.map((cat) => ({
    category: cat,
    count: countMap.get(cat) ?? 0,
  }))
}

// ─── 3. getPeriodRegularity ────────────────────────────────────────────────────

/**
 * Computes mean and standard deviation of cycle lengths derived from all
 * PeriodLogs for the profile. `regular = stdDev <= 3` days.
 * Returns sampleSize 0 with all-zero stats if fewer than 2 period logs.
 */
export async function getPeriodRegularity(
  profileId: string,
  userId: string,
): Promise<PeriodRegularity> {
  await assertProfileOwnership(profileId, userId)

  const logs = await prisma.periodLog.findMany({
    where: { profileId },
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  })

  if (logs.length < 2) {
    return { mean: 0, stdDev: 0, regular: true, sampleSize: 0 }
  }

  const starts = logs.map((l) => l.startDate)
  const cycleLengths = computeCycleLengths(starts).map((p) => p.cycleLength)

  if (cycleLengths.length === 0) {
    return { mean: 0, stdDev: 0, regular: true, sampleSize: 0 }
  }

  const sum = cycleLengths.reduce((s, v) => s + v, 0)
  const mean = sum / cycleLengths.length

  const variance =
    cycleLengths.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / cycleLengths.length
  const stdDev = Math.sqrt(variance)

  const roundedMean = Math.round(mean * 10) / 10
  const roundedStdDev = Math.round(stdDev * 10) / 10

  return {
    mean: roundedMean,
    stdDev: roundedStdDev,
    regular: roundedStdDev <= 3,
    sampleSize: cycleLengths.length,
  }
}

// ─── 4. getFertileWindowHistory ────────────────────────────────────────────────

/**
 * Reconstructs the fertile window for each historical cycle using the
 * formula: ovulation = nextPeriodStart − 14 days; fertileStart = ovulation − 5;
 * fertileEnd = ovulation + 1.
 *
 * Each entry's `cycleStart` is the startDate of the earlier log.
 * Returns [] when fewer than 2 period logs exist.
 */
export async function getFertileWindowHistory(
  profileId: string,
  userId: string,
  opts?: InsightsRangeOpts,
): Promise<FertileWindowPoint[]> {
  await assertProfileOwnership(profileId, userId)

  const where: {
    profileId: string
    startDate?: { gte?: Date; lte?: Date }
  } = { profileId }

  if (opts?.dateFrom || opts?.dateTo) {
    where.startDate = {}
    if (opts.dateFrom) where.startDate.gte = opts.dateFrom
    if (opts.dateTo) where.startDate.lte = opts.dateTo
  }

  const logs = await prisma.periodLog.findMany({
    where,
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  })

  if (logs.length < 2) return []

  const result: FertileWindowPoint[] = []
  for (let i = 0; i < logs.length - 1; i++) {
    const cycleStart = logs[i].startDate
    const nextStart = logs[i + 1].startDate

    const ovulation = addDays(nextStart, -14)
    const fertileStart = addDays(ovulation, -5)
    const fertileEnd = addDays(ovulation, 1)

    result.push({
      cycleStart: toYMD(cycleStart),
      fertileStart: toYMD(fertileStart),
      fertileEnd: toYMD(fertileEnd),
      ovulationDay: toYMD(ovulation),
    })
  }

  return result
}

// ─── 5. Phase pattern ──────────────────────────────────────────────────────────

export interface PhasePatternEntry {
  symptomId: string
  count: number
}

export interface RankPhasePatternInput {
  phase: CyclePhase
  /** Period start dates (ms), ascending. Consecutive starts bound a completed cycle. */
  periodStartsMsAsc: number[]
  periodLength: number
  symptomLogs: { dateMs: number; symptomId: string }[]
  /** Max symptoms returned. Default 3. */
  limit?: number
}

/**
 * Phase pattern: the symptoms logged most often in `phase` across completed
 * past cycles, ranked by count (ties by symptom id). A completed cycle runs
 * from one period start up to the next; its own length sets the phase
 * boundaries. Logs in the current (open) cycle and "All good" check-ins are
 * ignored, so this is empty until one cycle has closed with logs in it.
 */
export function rankPhasePattern({
  phase,
  periodStartsMsAsc,
  periodLength,
  symptomLogs,
  limit = 3,
}: RankPhasePatternInput): PhasePatternEntry[] {
  const counts = new Map<string, number>()
  for (const log of symptomLogs) {
    if (log.symptomId === ALL_GOOD_SYMPTOM_ID) continue
    for (let i = 0; i < periodStartsMsAsc.length - 1; i++) {
      const start = periodStartsMsAsc[i]
      const next = periodStartsMsAsc[i + 1]
      if (log.dateMs < start || log.dateMs >= next) continue
      const cycleLength = Math.round((next - start) / MS_PER_DAY)
      const cycleDay = Math.floor((log.dateMs - start) / MS_PER_DAY) + 1
      if (getCurrentPhase(cycleDay, periodLength, cycleLength) === phase) {
        counts.set(log.symptomId, (counts.get(log.symptomId) ?? 0) + 1)
      }
      break
    }
  }
  return [...counts.entries()]
    .map(([symptomId, count]) => ({ symptomId, count }))
    .sort((a, b) => b.count - a.count || a.symptomId.localeCompare(b.symptomId))
    .slice(0, limit)
}

/** Loads a profile's logs and ranks its Phase pattern. Caller has checked ownership. */
export async function loadPhasePattern(
  profileId: string,
  periodLength: number,
  phase: CyclePhase,
): Promise<PhasePatternEntry[]> {
  const periodLogs = await prisma.periodLog.findMany({
    where: { profileId },
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  })
  if (periodLogs.length < 2) return []
  const lastStart = periodLogs[periodLogs.length - 1].startDate
  const symptomLogs = await prisma.symptomLog.findMany({
    where: { profileId, date: { gte: periodLogs[0].startDate, lt: lastStart } },
    select: { date: true, symptomId: true },
  })
  return rankPhasePattern({
    phase,
    periodStartsMsAsc: periodLogs.map((l) => l.startDate.getTime()),
    periodLength,
    symptomLogs: symptomLogs.map((l) => ({ dateMs: l.date.getTime(), symptomId: l.symptomId })),
  })
}
