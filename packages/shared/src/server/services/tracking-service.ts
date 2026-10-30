import { Prisma, type SymptomCategory } from '@prisma/client'
import { prisma } from '../db'
import { getLatestPeriodLog, ensurePeriodLogFromProfile } from '../period-log-sync'
import { isPregnancy, isMenopause } from '../../utils/goal'
import { ALL_GOOD_SYMPTOM_ID } from '../../utils/symptoms'
import { TIER2_MIN_CYCLES } from '../prediction-calc'
import { ApiError } from '../api-error'
import { findOverlappingPeriod, periodDayKey } from '../../utils/period-overlap'
import { getCurrentPhase, MS_PER_DAY } from '../../utils/cycle-utils'
import {
  addDaysToDay,
  bangladeshToday,
  dayToStoredDate,
  daysBetween,
  storedDateToDay,
} from '../../utils/dhaka-date'
import type { CyclePhase } from '../../types/types'
import { loadPhasePattern, loadRecentSymptomPattern, type PhasePatternEntry } from './insights-service'

// ── Ownership helpers ──────────────────────────────────────────────────────────

async function verifyProfileOwnership(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) throw new Error('Profile not found')
  return profile
}

// ── Period log mutations ───────────────────────────────────────────────────────

/** Throws 409 PERIOD_OVERLAP if the inclusive day range shares a day with another log of the profile. */
async function assertNoPeriodOverlap(profileId: string, start: Date, end: Date, excludeId?: string) {
  const others = await prisma.periodLog.findMany({
    where: {
      profileId,
      ...(excludeId && { id: { not: excludeId } }),
      // Widen by a day each side so the exact day-string comparison decides, not time-of-day.
      startDate: { lte: new Date(end.getTime() + 86_400_000) },
      endDate: { gte: new Date(start.getTime() - 86_400_000) },
    },
    select: { id: true, startDate: true, endDate: true },
  })
  const hit = findOverlappingPeriod(
    { startDate: periodDayKey(start), endDate: periodDayKey(end) },
    others.map((o) => ({ id: o.id, startDate: periodDayKey(o.startDate), endDate: periodDayKey(o.endDate) })),
    excludeId,
  )
  if (hit) throw new ApiError(409, 'This period overlaps another logged period', 'PERIOD_OVERLAP')
}

export async function createPeriodLog(
  profileId: string,
  userId: string,
  data: {
    startDate: string
    endDate: string
    flowIntensity: 'LIGHT' | 'MEDIUM' | 'HEAVY'
  },
): Promise<{ log: Awaited<ReturnType<typeof prisma.periodLog.create>>; shouldRecalcPrediction: true }> {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  if (end < start) throw new Error('End date must be on or after start date')

  await verifyProfileOwnership(profileId, userId)
  await assertNoPeriodOverlap(profileId, start, end)

  const log = await prisma.periodLog.create({
    data: {
      profileId,
      startDate: start,
      endDate: end,
      flowIntensity: data.flowIntensity,
    },
  })

  return { log, shouldRecalcPrediction: true }
}

export async function updatePeriodLog(
  logId: string,
  userId: string,
  data: {
    startDate?: string
    endDate?: string
    flowIntensity?: 'LIGHT' | 'MEDIUM' | 'HEAVY'
  },
): Promise<{ log: Awaited<ReturnType<typeof prisma.periodLog.update>>; profileId: string; shouldRecalcPrediction: true }> {
  const existing = await prisma.periodLog.findUnique({
    where: { id: logId },
    include: { profile: true },
  })
  if (!existing || existing.profile.userId !== userId) throw new Error('Period log not found')

  const newStart = data.startDate !== undefined ? new Date(data.startDate) : existing.startDate
  const newEnd = data.endDate !== undefined ? new Date(data.endDate) : existing.endDate
  if (newEnd < newStart) throw new Error('End date must be on or after start date')
  if (data.startDate !== undefined || data.endDate !== undefined) {
    await assertNoPeriodOverlap(existing.profileId, newStart, newEnd, logId)
  }

  const log = await prisma.periodLog.update({
    where: { id: logId },
    data: {
      ...(data.startDate !== undefined && { startDate: newStart }),
      ...(data.endDate !== undefined && { endDate: newEnd }),
      ...(data.flowIntensity !== undefined && { flowIntensity: data.flowIntensity }),
    },
  })

  return { log, profileId: existing.profileId, shouldRecalcPrediction: true }
}

export async function deletePeriodLog(
  logId: string,
  userId: string,
): Promise<{ profileId: string; shouldRecalcPrediction: true }> {
  const log = await prisma.periodLog.findUnique({
    where: { id: logId },
    include: { profile: true },
  })
  if (!log || log.profile.userId !== userId) throw new Error('Period log not found')

  await prisma.periodLog.delete({ where: { id: logId } })

  return { profileId: log.profileId, shouldRecalcPrediction: true }
}

// ── Symptom log mutations ──────────────────────────────────────────────────────

export async function toggleSymptomLog(
  profileId: string,
  userId: string,
  data: {
    date: string
    category: 'PHYSICAL' | 'MOOD' | 'DISCHARGE' | 'LIFESTYLE'
    symptomId: string
    value: string
  },
) {
  await verifyProfileOwnership(profileId, userId)

  const existing = await prisma.symptomLog.findFirst({
    where: {
      profileId,
      symptomId: data.symptomId,
      date: new Date(data.date),
    },
  })

  if (existing) {
    await prisma.symptomLog.delete({ where: { id: existing.id } })
    return { action: 'deleted' as const }
  } else {
    // If adding a real symptom, remove any "all good" sentinel for that day first
    if (data.symptomId !== ALL_GOOD_SYMPTOM_ID) {
      await prisma.symptomLog.deleteMany({
        where: { profileId, date: new Date(data.date), symptomId: ALL_GOOD_SYMPTOM_ID },
      })
    }
    const log = await prisma.symptomLog.create({
      data: {
        profileId,
        date: new Date(data.date),
        category: data.category,
        symptomId: data.symptomId,
        value: data.value,
      },
    })
    return { action: 'created' as const, log }
  }
}

export async function setAllGoodToday(
  profileId: string,
  userId: string,
  date?: string,
): Promise<void> {
  await verifyProfileOwnership(profileId, userId)

  const dateStr =
    date ??
    (() => {
      const now = new Date()
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    })()

  const dayDate = new Date(dateStr)

  // Remove all real symptom logs for this day (keep only the sentinel)
  await prisma.symptomLog.deleteMany({
    where: {
      profileId,
      date: dayDate,
      NOT: { symptomId: ALL_GOOD_SYMPTOM_ID },
    },
  })

  // Create sentinel if not already present
  const existing = await prisma.symptomLog.findFirst({
    where: { profileId, date: dayDate, symptomId: ALL_GOOD_SYMPTOM_ID },
  })
  if (!existing) {
    await prisma.symptomLog.create({
      data: {
        profileId,
        date: dayDate,
        category: 'MOOD',
        symptomId: ALL_GOOD_SYMPTOM_ID,
        value: ALL_GOOD_SYMPTOM_ID,
      },
    })
  }
}

export async function saveSymptomLogs(
  profileId: string,
  userId: string,
  data: {
    date: string
    added: { symptomId: string; category: SymptomCategory; value: string }[]
    removed: string[]
  },
) {
  await verifyProfileOwnership(profileId, userId)
  const day = new Date(data.date)
  const addedIds = data.added.map((a) => a.symptomId)

  const ops: Prisma.PrismaPromise<unknown>[] = []
  if (data.removed.length) {
    ops.push(
      prisma.symptomLog.deleteMany({
        where: { profileId, date: day, symptomId: { in: data.removed } },
      }),
    )
  }
  if (data.added.length) {
    // logging real symptoms clears the "all good" sentinel for the day
    ops.push(
      prisma.symptomLog.deleteMany({
        where: { profileId, date: day, symptomId: ALL_GOOD_SYMPTOM_ID },
      }),
    )
    // idempotent: drop any existing rows for these ids before recreating
    ops.push(
      prisma.symptomLog.deleteMany({
        where: { profileId, date: day, symptomId: { in: addedIds } },
      }),
    )
    ops.push(
      prisma.symptomLog.createMany({
        data: data.added.map((a) => ({
          profileId,
          date: day,
          category: a.category,
          symptomId: a.symptomId,
          value: a.value,
        })),
      }),
    )
  }
  if (ops.length) await prisma.$transaction(ops)
  return { added: data.added.length, removed: data.removed.length }
}

// ── Engagement summary ─────────────────────────────────────────────────────────

export async function getEngagementSummary(
  profileId: string,
  userId: string,
): Promise<{
  loggedToday: boolean
  lastLoggedDate: string | null
  streak: number
  streakAtRisk: boolean
  last30: { date: string; logged: boolean }[]
  cyclesLogged: number
  periodLogCount: number
  unlockTarget: number
  tier: 'AVERAGE' | 'ARIMA' | 'LSTM' | null
  confidence: number
} | null> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) return null

  // Build UTC-normalized today string
  const now = new Date()
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`

  // Window: last 30 calendar days (today = day 29, oldest = day 0)
  const windowStart = new Date(todayStr)
  windowStart.setUTCDate(windowStart.getUTCDate() - 29)

  // Fetch symptom logs within the 30-day window and period logs overlapping it — independent reads
  const [symptomLogsInWindow, periodLogsInWindow] = await Promise.all([
    prisma.symptomLog.findMany({
      where: {
        profileId,
        date: { gte: windowStart },
      },
      select: { date: true },
    }),
    prisma.periodLog.findMany({
      where: {
        profileId,
        startDate: { lte: new Date(todayStr) },
        endDate: { gte: windowStart },
      },
      select: { startDate: true, endDate: true },
    }),
  ])

  // Build set of active day strings (YYYY-MM-DD UTC)
  const activeDays = new Set<string>()

  for (const sl of symptomLogsInWindow) {
    const d = sl.date
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    activeDays.add(key)
  }

  // Expand period log ranges into individual days within the window
  const windowStartStr = windowStart.toISOString().slice(0, 10)
  for (const pl of periodLogsInWindow) {
    const cur = new Date(pl.startDate)
    cur.setUTCHours(0, 0, 0, 0)
    const end = new Date(pl.endDate)
    end.setUTCHours(0, 0, 0, 0)
    while (cur <= end) {
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`
      if (key >= windowStartStr && key <= todayStr) {
        activeDays.add(key)
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }

  // Build last30 array (oldest first, newest = today)
  const last30: { date: string; logged: boolean }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayStr)
    d.setUTCDate(d.getUTCDate() - i)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    last30.push({ date: key, logged: activeDays.has(key) })
  }

  // Compute streak (walk backward from today)
  let streak = 0
  let streakAtRisk = false
  const todayLogged = activeDays.has(todayStr)

  const yesterdayDate = new Date(todayStr)
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)
  const yesterdayStr = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getUTCDate()).padStart(2, '0')}`

  if (todayLogged) {
    // Count backward from today
    for (let i = 0; i < last30.length; i++) {
      const entry = last30[last30.length - 1 - i]
      if (entry.logged) {
        streak++
      } else {
        break
      }
    }
  } else if (activeDays.has(yesterdayStr)) {
    // Grace: streak alive from yesterday, today not logged yet
    streakAtRisk = true
    for (let i = 1; i < last30.length; i++) {
      const entry = last30[last30.length - 1 - i]
      if (entry.logged) {
        streak++
      } else {
        break
      }
    }
  }
  // else streak = 0, streakAtRisk = false

  // loggedToday: same logic as getLoggingStatus (symptom log today OR today within a period range)
  const today = new Date(todayStr)
  const tomorrow = new Date(todayStr)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  const [symptomToday, periodToday] = await Promise.all([
    prisma.symptomLog.findFirst({
      where: { profileId, date: { gte: today, lt: tomorrow } },
      select: { id: true },
    }),
    prisma.periodLog.findFirst({
      where: { profileId, startDate: { lte: today }, endDate: { gte: today } },
      select: { id: true },
    }),
  ])
  const loggedToday = Boolean(symptomToday || periodToday)

  // lastLoggedDate: most recent active day key
  let lastLoggedDate: string | null = null
  for (let i = last30.length - 1; i >= 0; i--) {
    if (last30[i].logged) {
      lastLoggedDate = last30[i].date
      break
    }
  }

  // cyclesLogged and tier/confidence — independent reads, fetch in parallel
  const [allPeriodLogs, predRecord] = await Promise.all([
    prisma.periodLog.findMany({
      where: { profileId },
      orderBy: { startDate: 'asc' },
      select: { startDate: true },
    }),
    prisma.prediction.findUnique({ where: { profileId } }),
  ])
  let cyclesLogged = 0
  for (let i = 1; i < allPeriodLogs.length; i++) {
    const gap = Math.round(
      (allPeriodLogs[i].startDate.getTime() - allPeriodLogs[i - 1].startDate.getTime()) /
        MS_PER_DAY,
    )
    if (gap > 0 && gap < 90) cyclesLogged++
  }
  const tier = (predRecord?.tier as 'AVERAGE' | 'ARIMA' | 'LSTM' | null) ?? null
  const confidence = predRecord?.confidence ?? 0

  return {
    loggedToday,
    lastLoggedDate,
    streak,
    streakAtRisk,
    last30,
    cyclesLogged,
    periodLogCount: allPeriodLogs.length,
    unlockTarget: TIER2_MIN_CYCLES,
    tier,
    confidence,
  }
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function listPeriodLogs(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) return []

  await ensurePeriodLogFromProfile(profile)

  return prisma.periodLog.findMany({
    where: { profileId },
    orderBy: { startDate: 'desc' },
  })
}

export async function getSymptomLogs(profileId: string, userId: string, date?: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) return []

  const where: Record<string, unknown> = { profileId }
  if (date) {
    const day = new Date(date)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    where.date = { gte: day, lt: nextDay }
  }

  return prisma.symptomLog.findMany({
    where,
    orderBy: { date: 'desc' },
  })
}

export async function getPrediction(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) return null
  return prisma.prediction.findUnique({ where: { profileId } })
}

export async function getProfilesForReminders(userId?: string) {
  return prisma.profile.findMany({
    where: userId ? { userId } : undefined,
    include: {
      user: true,
      predictions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      notificationPref: true,
      periodLogs: {
        orderBy: { startDate: 'desc' },
        take: 1,
      },
    },
  })
}

// ── Current cycle position ─────────────────────────────────────────────────────

/**
 * Cycle day and phase the dashboard shows. The phase comes from the shared
 * `getCurrentPhase`, the same classifier the stepper's day ranges and the
 * Phase pattern ranking use, so all three always name the same phase.
 * The cycle day is capped at the cycle length (a late period stays on the last day).
 */
export function dashboardCycleState({
  lastStartMs,
  todayMs,
  periodLength,
  cycleLength,
}: {
  /** Start of the latest period, at day start. */
  lastStartMs: number
  /** Today, at day start. */
  todayMs: number
  periodLength: number
  cycleLength: number
}): { cycleDay: number; phase: CyclePhase } {
  const rawCycleDay = Math.max(1, Math.round((todayMs - lastStartMs) / MS_PER_DAY) + 1)
  const cycleDay = Math.min(rawCycleDay, cycleLength)
  return { cycleDay, phase: getCurrentPhase(cycleDay, periodLength, cycleLength) }
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export async function getDashboardData(profileId: string, userId: string, now: Date) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) return null

  const [lastPeriod, prediction, lastSymptomLog] = await Promise.all([
    getLatestPeriodLog(profile),
    prisma.prediction.findUnique({ where: { profileId: profile.id } }),
    prisma.symptomLog.findFirst({
      where: { profileId },
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
  ])

  // Every date here is a Bangladesh-day string; stored date-only values are UTC midnight of their day.
  const today = bangladeshToday(now)

  let currentCycleDay = 1
  let currentPhase: CyclePhase = 'follicular'
  let countdownToNextPeriod: number | null = null

  if (lastPeriod) {
    const state = dashboardCycleState({
      lastStartMs: lastPeriod.startDate.getTime(),
      todayMs: dayToStoredDate(today).getTime(),
      periodLength: profile.periodLength,
      cycleLength: profile.cycleLength,
    })
    currentCycleDay = state.cycleDay
    currentPhase = state.phase
  }

  if (prediction?.nextPeriodStart) {
    countdownToNextPeriod = daysBetween(today, storedDateToDay(prediction.nextPeriodStart))
  } else if (lastPeriod) {
    const nextEstimated = addDaysToDay(storedDateToDay(lastPeriod.startDate), profile.cycleLength)
    countdownToNextPeriod = daysBetween(today, nextEstimated)
  }

  const lastPeriodSummary = lastPeriod
    ? {
        startDate: lastPeriod.startDate,
        duration:
          Math.floor(
            (new Date(lastPeriod.endDate).getTime() - new Date(lastPeriod.startDate).getTime()) /
              MS_PER_DAY,
          ) + 1,
        flowIntensity: lastPeriod.flowIntensity,
      }
    : null

  const lastSymptomLogDate: Date | null = lastSymptomLog?.date ?? null

  const mode: 'standard' | 'pregnancy' | 'menopause' = isPregnancy(profile.goal)
    ? 'pregnancy'
    : isMenopause(profile.goal)
      ? 'menopause'
      : 'standard'

  const pregnant = mode === 'pregnancy'

  // Phase pattern (#75): only meaningful when a current phase is shown.
  const phasePattern: PhasePatternEntry[] =
    mode === 'standard' && lastPeriod
      ? await loadPhasePattern(profileId, profile.periodLength, currentPhase)
      : []
  // Symptom pattern (#66 S1): menopause has no phases, so it ranks a recent window instead.
  const symptomPattern: PhasePatternEntry[] = mode === 'menopause' ? await loadRecentSymptomPattern(profileId, now) : []

  return {
    mode,
    currentCycleDay,
    currentPhase: pregnant ? null : currentPhase,
    countdownToNextPeriod: pregnant ? null : countdownToNextPeriod,
    lastPeriod: lastPeriodSummary,
    prediction: pregnant ? null : prediction,
    lastSymptomLogDate,
    phasePattern,
    symptomPattern,
  }
}

// ── Logging status ────────────────────────────────────────────────────────────

export async function getLoggingStatus(
  profileId: string,
  userId: string,
  now: Date,
): Promise<{ goal: string | null; loggedToday: boolean; isPeriodLate: boolean; daysLate: number } | null> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) return null

  // Date-only logs are stored at UTC midnight of their Bangladesh day.
  const todayStr = bangladeshToday(now)
  const today = dayToStoredDate(todayStr)
  const tomorrow = dayToStoredDate(addDaysToDay(todayStr, 1))

  const [symptomToday, periodToday] = await Promise.all([
    prisma.symptomLog.findFirst({
      where: { profileId, date: { gte: today, lt: tomorrow } },
      select: { id: true },
    }),
    prisma.periodLog.findFirst({
      where: { profileId, startDate: { lte: today }, endDate: { gte: today } },
      select: { id: true },
    }),
  ])
  const loggedToday = Boolean(symptomToday || periodToday)

  // Reuse the dashboard countdown so "late" never drifts from the dashboard.
  const dash = await getDashboardData(profileId, userId, now)
  const countdown = dash?.countdownToNextPeriod ?? null
  const isPeriodLate = countdown != null && countdown < 0
  const daysLate = isPeriodLate ? Math.abs(countdown as number) : 0

  return { goal: profile.goal ?? null, loggedToday, isPeriodLate, daysLate }
}

// ── Calendar ───────────────────────────────────────────────────────────────────

interface CalendarDay {
  date: string
  period: boolean
  fertile: boolean
  ovulation: boolean
  predicted: boolean
}

export async function getCalendarData(
  profileId: string,
  userId: string,
  month: string,
): Promise<CalendarDay[] | null> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) return null

  // Day math runs on Bangladesh-day strings (UTC-only helpers), so the answer is the same in any
  // process timezone. Stored dates are UTC midnight of their day.
  const [year, monthNum] = month.split('-').map(Number)
  const firstDay = `${String(year).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-01`
  const lastDay = storedDateToDay(new Date(Date.UTC(year, monthNum, 0)))
  const inMonth = (day: string) => day >= firstDay && day <= lastDay

  await ensurePeriodLogFromProfile(profile)

  const periodLogs = await prisma.periodLog.findMany({
    where: {
      profileId: profile.id,
      startDate: { lte: dayToStoredDate(lastDay) },
      endDate: { gte: dayToStoredDate(firstDay) },
    },
  })

  const prediction = await prisma.prediction.findUnique({ where: { profileId: profile.id } })

  const periodDates = new Set<string>()
  const predictedDates = new Set<string>()
  const fertileDates = new Set<string>()
  const ovulationDates = new Set<string>()

  for (const log of periodLogs) {
    const end = storedDateToDay(log.endDate)
    for (let d = storedDateToDay(log.startDate); d <= end; d = addDaysToDay(d, 1)) {
      if (inMonth(d)) periodDates.add(d)
    }
  }

  if (!isPregnancy(profile.goal)) {
    // Determine the anchor for forward projections.
    // If a Prediction record exists, use it as cycle 1 and project cycles 2-3.
    // Otherwise, estimate from the most recent period log.
    let anchorPeriodStart: string | null = null

    if (prediction?.nextPeriodStart) {
      anchorPeriodStart = storedDateToDay(prediction.nextPeriodStart)
    } else {
      const lastLog = await prisma.periodLog.findFirst({
        where: { profileId: profile.id },
        orderBy: { startDate: 'desc' },
      })
      if (lastLog) {
        anchorPeriodStart = addDaysToDay(storedDateToDay(lastLog.startDate), profile.cycleLength)
      }
    }

    // Project up to 3 future cycles (period, fertile window, ovulation)
    if (anchorPeriodStart) {
      const { cycleLength, periodLength } = profile

      for (let cycle = 0; cycle < 3; cycle++) {
        const cycleStart = addDaysToDay(anchorPeriodStart, cycle * cycleLength)

        // Predicted period days — mark as both period and predicted
        const periodEnd = addDaysToDay(cycleStart, periodLength - 1)
        for (let d = cycleStart; d <= periodEnd; d = addDaysToDay(d, 1)) {
          if (inMonth(d) && !periodDates.has(d)) {
            predictedDates.add(d)
            periodDates.add(d)
          }
        }

        // Ovulation = next period start - 14 days
        const ovDay = addDaysToDay(cycleStart, -14)
        if (inMonth(ovDay)) ovulationDates.add(ovDay)

        // Fertile window = ovulation - 5 days to ovulation + 1 day
        for (let offset = -5; offset <= 1; offset++) {
          const fDay = addDaysToDay(ovDay, offset)
          if (inMonth(fDay)) fertileDates.add(fDay)
        }
      }
    }
  }

  const days: CalendarDay[] = []
  for (let dateStr = firstDay; dateStr <= lastDay; dateStr = addDaysToDay(dateStr, 1)) {
    days.push({
      date: dateStr,
      period: periodDates.has(dateStr),
      fertile: fertileDates.has(dateStr),
      ovulation: ovulationDates.has(dateStr),
      predicted: predictedDates.has(dateStr),
    })
  }

  return days
}
