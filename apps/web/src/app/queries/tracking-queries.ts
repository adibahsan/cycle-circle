import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireCurrentUser } from './auth-queries'
import {
  getLatestPeriodLog,
  ensurePeriodLogFromProfile,
  addPeriodDatesInRange,
} from '@vesta/shared/server/period-log-sync'

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

export const getDashboardData = cache(async (profileId: string) => {
  const user = await requireCurrentUser()

  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== user.id) return null

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
    currentCycleDay = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)

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
    countdownToNextPeriod = Math.max(
      0,
      Math.ceil((nextStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    )
  } else if (lastPeriod) {
    const lastStart = new Date(lastPeriod.startDate)
    lastStart.setHours(0, 0, 0, 0)
    const nextEstimated = new Date(lastStart)
    nextEstimated.setDate(nextEstimated.getDate() + profile.cycleLength)
    countdownToNextPeriod = Math.max(
      0,
      Math.ceil((nextEstimated.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
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

  return { currentCycleDay, currentPhase, countdownToNextPeriod, lastPeriod: lastPeriodSummary, prediction }
})

interface CalendarDay {
  date: string
  period: boolean
  fertile: boolean
  ovulation: boolean
  predicted: boolean
}

export const getCalendarData = cache(async (profileId: string, month: string) => {
  const user = await requireCurrentUser()

  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== user.id) return null

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
  let ovulationDateStr: string | null = null

  for (const log of periodLogs) {
    addPeriodDatesInRange(
      new Date(log.startDate),
      new Date(log.endDate),
      monthStart,
      monthEnd,
      periodDates,
    )
  }

  if (prediction?.nextPeriodStart) {
    const predStart = new Date(prediction.nextPeriodStart)
    predStart.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (predStart > today) {
      const predEnd = new Date(predStart)
      predEnd.setDate(predEnd.getDate() + profile.periodLength - 1)
      const cur = new Date(predStart)
      while (cur <= predEnd) {
        if (cur >= monthStart && cur <= monthEnd) {
          predictedDates.add(cur.toISOString().slice(0, 10))
        }
        cur.setDate(cur.getDate() + 1)
      }
    }
  }

  if (prediction?.ovulationDay) {
    const ovDate = new Date(prediction.ovulationDay)
    ovDate.setHours(0, 0, 0, 0)
    if (ovDate >= monthStart && ovDate <= monthEnd) {
      ovulationDateStr = ovDate.toISOString().slice(0, 10)
    }
    for (let offset = -5; offset <= 0; offset++) {
      const fertileDate = new Date(ovDate)
      fertileDate.setDate(fertileDate.getDate() + offset)
      if (fertileDate >= monthStart && fertileDate <= monthEnd) {
        fertileDates.add(fertileDate.toISOString().slice(0, 10))
      }
    }
  } else if (prediction?.fertileStart && prediction?.fertileEnd) {
    const fStart = new Date(prediction.fertileStart)
    const fEnd = new Date(prediction.fertileEnd)
    fStart.setHours(0, 0, 0, 0)
    fEnd.setHours(0, 0, 0, 0)
    const cur = new Date(fStart)
    while (cur <= fEnd) {
      if (cur >= monthStart && cur <= monthEnd) {
        fertileDates.add(cur.toISOString().slice(0, 10))
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  const days: CalendarDay[] = []
  const cur = new Date(monthStart)
  while (cur <= monthEnd) {
    const dateStr = cur.toISOString().slice(0, 10)
    days.push({
      date: dateStr,
      period: periodDates.has(dateStr),
      fertile: fertileDates.has(dateStr),
      ovulation: dateStr === ovulationDateStr,
      predicted: predictedDates.has(dateStr),
    })
    cur.setDate(cur.getDate() + 1)
  }

  return days
})

export const getPeriodLogs = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== user.id) return []

  await ensurePeriodLogFromProfile(profile)

  return prisma.periodLog.findMany({
    where: { profileId },
    orderBy: { startDate: 'desc' },
  })
})
