import type { PeriodLog, Profile } from '@prisma/client'
import { prisma } from './db'
import { enqueueJob } from './adapters/jobs'

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
 * create an initial PeriodLog and seed a Tier 1 Prediction synchronously so the
 * dashboard/calendar have data immediately — without waiting for the async worker.
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

  // Seed Tier 1 prediction synchronously from onboarding data (SRS FR-PRED:
  // "Onboarding data shall seed Tier 1 predictions immediately")
  await seedTier1Prediction(profile, startDate)

  // Also enqueue for the worker in case it refines with additional history
  await enqueueJob('PREDICTION_RECALC', { profileId: profile.id })

  return created
}

/**
 * Compute and upsert a Tier 1 (simple average) prediction from a single period start
 * and the profile's configured cycle/period lengths.
 */
async function seedTier1Prediction(profile: Profile, lastPeriodStart: Date): Promise<void> {
  const nextPeriodStart = new Date(lastPeriodStart)
  nextPeriodStart.setDate(nextPeriodStart.getDate() + profile.cycleLength)

  const ovulationDay = new Date(nextPeriodStart)
  ovulationDay.setDate(ovulationDay.getDate() - 14)

  const fertileStart = new Date(ovulationDay)
  fertileStart.setDate(fertileStart.getDate() - 5)

  const fertileEnd = new Date(ovulationDay)
  fertileEnd.setDate(fertileEnd.getDate() + 1)

  await prisma.prediction.upsert({
    where: { profileId: profile.id },
    update: {
      tier: 'AVERAGE',
      nextPeriodStart,
      ovulationDay,
      fertileStart,
      fertileEnd,
      confidence: 0.5,
    },
    create: {
      profileId: profile.id,
      tier: 'AVERAGE',
      nextPeriodStart,
      ovulationDay,
      fertileStart,
      fertileEnd,
      confidence: 0.5,
    },
  })
}

/** Latest period log, materializing from profile.lastPeriodStart when missing. */
export async function getLatestPeriodLog(profile: Profile): Promise<PeriodLog | null> {
  return ensurePeriodLogFromProfile(profile)
}
