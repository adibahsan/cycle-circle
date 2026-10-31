import type { FlowIntensity, PeriodLog, Profile } from '@prisma/client'
import { prisma } from './db'
import { recalculatePrediction } from './prediction-calc'
import { addDaysToDay, dayToStoredDate, storedDateToDay } from '../utils/dhaka-date'

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

/**
 * Latest period log. A logged period always wins (even when profile.lastPeriodStart is null);
 * only when none exists is one materialized from profile.lastPeriodStart.
 */
export async function getLatestPeriodLog(profile: Profile): Promise<PeriodLog | null> {
  const latest = await prisma.periodLog.findFirst({
    where: { profileId: profile.id },
    orderBy: { startDate: 'desc' },
  })
  return latest ?? ensurePeriodLogFromProfile(profile)
}
