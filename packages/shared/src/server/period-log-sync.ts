import type { FlowIntensity, PeriodLog, Profile } from '@prisma/client'
import { prisma } from './db'
import { recalculatePrediction } from './prediction-calc'
import { addDaysToDay, dayToStoredDate, storedDateToDay } from '../utils/dhaka-date'

/**
 * Add each day in [start, end] that falls within [monthStart, monthEnd] to periodDates.
 * All four bounds are stored date-only values (UTC midnight); days are walked as
 * Bangladesh-day strings, so the result is the same in any process timezone.
 */
export function addPeriodDatesInRange(
  start: Date,
  end: Date,
  monthStart: Date,
  monthEnd: Date,
  periodDates: Set<string>,
): void {
  const from = storedDateToDay(monthStart)
  const to = storedDateToDay(monthEnd)
  const last = storedDateToDay(end)
  for (let day = storedDateToDay(start); day <= last; day = addDaysToDay(day, 1)) {
    if (day >= from && day <= to) periodDates.add(day)
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

  const startDay = storedDateToDay(profile.lastPeriodStart)
  const startDate = dayToStoredDate(startDay)
  const endDate = dayToStoredDate(addDaysToDay(startDay, Math.max(profile.periodLength, 1) - 1))

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
