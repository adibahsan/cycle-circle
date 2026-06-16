import { prisma } from '../db'
import {
  getLatestPeriodLog,
  ensurePeriodLogFromProfile,
  addPeriodDatesInRange,
  toLocalDateStr,
} from '../period-log-sync'
import { isPregnancy, isMenopause } from '../../utils/goal'

// ── Ownership helpers ──────────────────────────────────────────────────────────

async function verifyProfileOwnership(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) throw new Error('Profile not found')
  return profile
}

// ── Period log mutations ───────────────────────────────────────────────────────

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

  const log = await prisma.periodLog.update({
    where: { id: logId },
    data: {
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
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

export async function getProfilesForReminders() {
  return prisma.profile.findMany({
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

// ── Phase calculation ──────────────────────────────────────────────────────────

type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

function calculatePhase(
  currentCycleDay: number,
  periodLength: number,
  cycleLength: number,
  ovulationDay: number,
): CyclePhase {
  if (currentCycleDay <= periodLength) return 'menstrual'
  if (currentCycleDay >= ovulationDay - 1 && currentCycleDay <= ovulationDay + 1) return 'ovulatory'
  if (currentCycleDay < ovulationDay - 1) return 'follicular'
  return 'luteal'
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export async function getDashboardData(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) return null

  const lastPeriod = await getLatestPeriodLog(profile)
  const prediction = await prisma.prediction.findUnique({ where: { profileId: profile.id } })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let currentCycleDay = 1
  let currentPhase: CyclePhase = 'follicular'
  let countdownToNextPeriod: number | null = null

  const estimatedOvulationDayInCycle = profile.cycleLength - 14

  if (lastPeriod) {
    const lastStart = new Date(lastPeriod.startDate)
    lastStart.setHours(0, 0, 0, 0)
    const diffMs = today.getTime() - lastStart.getTime()
    const rawCycleDay = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)
    currentCycleDay = Math.min(rawCycleDay, profile.cycleLength)

    let ovulationDayInCycle = estimatedOvulationDayInCycle
    if (prediction?.ovulationDay) {
      const ovDate = new Date(prediction.ovulationDay)
      ovDate.setHours(0, 0, 0, 0)
      ovulationDayInCycle =
        Math.floor((ovDate.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }

    currentPhase = calculatePhase(
      currentCycleDay,
      profile.periodLength,
      profile.cycleLength,
      ovulationDayInCycle,
    )
  }

  if (prediction?.nextPeriodStart) {
    const nextStart = new Date(prediction.nextPeriodStart)
    nextStart.setHours(0, 0, 0, 0)
    countdownToNextPeriod = Math.ceil(
      (nextStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )
  } else if (lastPeriod) {
    const lastStart = new Date(lastPeriod.startDate)
    lastStart.setHours(0, 0, 0, 0)
    const nextEstimated = new Date(lastStart)
    nextEstimated.setDate(nextEstimated.getDate() + profile.cycleLength)
    countdownToNextPeriod = Math.ceil(
      (nextEstimated.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )
  }

  const lastPeriodSummary = lastPeriod
    ? {
        startDate: lastPeriod.startDate,
        duration:
          Math.floor(
            (new Date(lastPeriod.endDate).getTime() - new Date(lastPeriod.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        flowIntensity: lastPeriod.flowIntensity,
      }
    : null

  const lastSymptomLog = await prisma.symptomLog.findFirst({
    where: { profileId },
    orderBy: { date: 'desc' },
    select: { date: true },
  })
  const lastSymptomLogDate: Date | null = lastSymptomLog?.date ?? null

  const mode: 'standard' | 'pregnancy' | 'menopause' = isPregnancy(profile.goal)
    ? 'pregnancy'
    : isMenopause(profile.goal)
      ? 'menopause'
      : 'standard'

  const pregnant = mode === 'pregnancy'

  return {
    mode,
    currentCycleDay,
    currentPhase: pregnant ? null : currentPhase,
    countdownToNextPeriod: pregnant ? null : countdownToNextPeriod,
    lastPeriod: lastPeriodSummary,
    prediction: pregnant ? null : prediction,
    lastSymptomLogDate,
  }
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

  const [year, monthNum] = month.split('-').map(Number)
  const monthStart = new Date(year, monthNum - 1, 1)
  const monthEnd = new Date(year, monthNum, 0)

  await ensurePeriodLogFromProfile(profile)

  const periodLogs = await prisma.periodLog.findMany({
    where: {
      profileId: profile.id,
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
  })

  const prediction = await prisma.prediction.findUnique({ where: { profileId: profile.id } })

  const periodDates = new Set<string>()
  const predictedDates = new Set<string>()
  const fertileDates = new Set<string>()
  const ovulationDates = new Set<string>()

  for (const log of periodLogs) {
    addPeriodDatesInRange(
      new Date(log.startDate),
      new Date(log.endDate),
      monthStart,
      monthEnd,
      periodDates,
    )
  }

  if (!isPregnancy(profile.goal)) {
    // Determine the anchor for forward projections.
    // If a Prediction record exists, use it as cycle 1 and project cycles 2-3.
    // Otherwise, estimate from the most recent period log.
    let anchorPeriodStart: Date | null = null

    if (prediction?.nextPeriodStart) {
      anchorPeriodStart = new Date(prediction.nextPeriodStart)
    } else {
      const lastLog = await prisma.periodLog.findFirst({
        where: { profileId: profile.id },
        orderBy: { startDate: 'desc' },
      })
      if (lastLog) {
        anchorPeriodStart = new Date(lastLog.startDate)
        anchorPeriodStart.setDate(anchorPeriodStart.getDate() + profile.cycleLength)
      }
    }

    // Project up to 3 future cycles (period, fertile window, ovulation)
    if (anchorPeriodStart) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { cycleLength, periodLength } = profile

      for (let cycle = 0; cycle < 3; cycle++) {
        const cycleStart = new Date(anchorPeriodStart)
        cycleStart.setDate(cycleStart.getDate() + cycle * cycleLength)
        cycleStart.setHours(0, 0, 0, 0)

        // Predicted period days — mark as both period and predicted
        const periodEnd = new Date(cycleStart)
        periodEnd.setDate(periodEnd.getDate() + periodLength - 1)
        const d = new Date(cycleStart)
        while (d <= periodEnd) {
          if (d >= monthStart && d <= monthEnd) {
            const ds = toLocalDateStr(d)
            if (!periodDates.has(ds)) {
              predictedDates.add(ds)
              periodDates.add(ds)
            }
          }
          d.setDate(d.getDate() + 1)
        }

        // Ovulation = next period start - 14 days
        const ovDay = new Date(cycleStart)
        ovDay.setDate(ovDay.getDate() - 14)
        ovDay.setHours(0, 0, 0, 0)
        if (ovDay >= monthStart && ovDay <= monthEnd) {
          ovulationDates.add(toLocalDateStr(ovDay))
        }

        // Fertile window = ovulation - 5 days to ovulation + 1 day
        for (let offset = -5; offset <= 1; offset++) {
          const fDay = new Date(ovDay)
          fDay.setDate(fDay.getDate() + offset)
          if (fDay >= monthStart && fDay <= monthEnd) {
            fertileDates.add(toLocalDateStr(fDay))
          }
        }
      }
    }
  }

  const days: CalendarDay[] = []
  const cur = new Date(monthStart)
  while (cur <= monthEnd) {
    const dateStr = toLocalDateStr(cur)
    days.push({
      date: dateStr,
      period: periodDates.has(dateStr),
      fertile: fertileDates.has(dateStr),
      ovulation: ovulationDates.has(dateStr),
      predicted: predictedDates.has(dateStr),
    })
    cur.setDate(cur.getDate() + 1)
  }

  return days
}
