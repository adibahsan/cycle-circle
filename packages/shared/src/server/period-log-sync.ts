import type { FlowIntensity, PeriodLog, Profile } from '@prisma/client'
import { prisma } from './db'
import { recalculatePrediction } from './prediction-calc'

/** Format a Date as YYYY-MM-DD in local timezone (avoids UTC shift from toISOString). */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Add each day in [start, end] that falls within [monthStart, monthEnd] to periodDates. */
export function addPeriodDatesInRange(
  start: Date,
  end: Date,
  monthStart: Date,
  monthEnd: Date,
  periodDates: Set<string>,
): void {
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  while (cur <= endDay) {
    if (cur >= monthStart && cur <= monthEnd) {
      periodDates.add(toLocalDateStr(cur))
    }
    cur.setDate(cur.getDate() + 1)
  }
}

/**
 * If the profile has lastPeriodStart but no period logs yet (e.g. from onboarding),
 * create an initial PeriodLog and recalculate the prediction synchronously so the
 * dashboard/calendar have data immediately.
 */
export async function ensurePeriodLogFromProfile(profile: Profile, flowIntensity?: FlowIntensity): Promise<PeriodLog | null> {
  if (!profile.lastPeriodStart) return null

  const existing = await prisma.periodLog.findFirst({
    where: { profileId: profile.id },
    orderBy: { startDate: 'desc' },
  })
  if (existing) return existing

  const startDate = new Date(profile.lastPeriodStart)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + Math.max(profile.periodLength, 1) - 1)

  const created = await prisma.periodLog.create({
    data: {
      profileId: profile.id,
      startDate,
      endDate,
      flowIntensity: flowIntensity ?? 'MEDIUM',
    },
  })

  await recalculatePrediction(profile.id)

  return created
}

/** Latest period log, materializing from profile.lastPeriodStart when missing. */
export async function getLatestPeriodLog(profile: Profile): Promise<PeriodLog | null> {
  return ensurePeriodLogFromProfile(profile)
}
