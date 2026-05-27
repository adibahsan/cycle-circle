import type { PeriodLog, Profile } from '@prisma/client'
import { prisma } from '@/server/db'
import { enqueueJob } from '@/server/adapters/jobs'

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
      periodDates.add(cur.toISOString().slice(0, 10))
    }
    cur.setDate(cur.getDate() + 1)
  }
}

/**
 * If the profile has lastPeriodStart but no period logs yet (e.g. from onboarding),
 * create an initial PeriodLog so dashboard/calendar can display it.
 */
export async function ensurePeriodLogFromProfile(profile: Profile): Promise<PeriodLog | null> {
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
      flowIntensity: 'MEDIUM',
    },
  })

  await enqueueJob('PREDICTION_RECALC', { profileId: profile.id })

  return created
}

/** Latest period log, materializing from profile.lastPeriodStart when missing. */
export async function getLatestPeriodLog(profile: Profile): Promise<PeriodLog | null> {
  return ensurePeriodLogFromProfile(profile)
}
