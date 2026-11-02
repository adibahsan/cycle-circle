/**
 * Demo history for the Analytics and Engagement chapters (#246): period logs, symptom logs,
 * predictions and nightly accuracy snapshots for the seeded `hbdemo-*` members (fake data only).
 * Idempotent (skipDuplicates) so both chapter files can call it.
 */
import type { PrismaClient } from '@prisma/client'
import { seedDemoMembers } from '../../support/admin-demo.ts'
import { demoNow } from '../../support/demo-clock.ts'

const DAY = 24 * 60 * 60 * 1000
const utcDay = (now: Date, n: number) => new Date(`${new Date(now.getTime() - n * DAY).toISOString().slice(0, 10)}T00:00:00.000Z`)
const SYMPTOMS: Array<[ 'PHYSICAL' | 'MOOD' | 'DISCHARGE' | 'LIFESTYLE', string ]> = [
  ['PHYSICAL', 'cramps'], ['PHYSICAL', 'headache'], ['PHYSICAL', 'bloating'], ['MOOD', 'mood_swings'], ['MOOD', 'anxious'],
  ['LIFESTYLE', 'fatigue'], ['DISCHARGE', 'creamy'], ['PHYSICAL', 'back_pain'],
]
// Members that are neither suspended nor deleted (see ROSTER in admin-demo.ts): indexes 0..23 except 15, 17 etc. are skipped by profile lookup.
const MEMBERS = Array.from({ length: 24 }, (_, i) => `hbdemo-${String(i + 1).padStart(2, '0')}`)

export async function seedAnalyticsHistory(db: PrismaClient): Promise<void> {
  await seedDemoMembers(db)
  const now = demoNow()
  const profiles = await db.profile.findMany({
    where: { userId: { in: MEMBERS }, user: { deletedAt: null } },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const periods = profiles.flatMap((p, i) =>
    [0, 1, 2, 3, 4].map((k) => {
      const start = new Date(now.getTime() - (4 + (i % 5) + k * (27 + (i % 4))) * DAY)
      return {
        id: `hbac-pl-${p.id}-${k}`, profileId: p.id, startDate: start,
        endDate: new Date(start.getTime() + 4 * DAY), flowIntensity: 'MEDIUM' as const,
      }
    }),
  )
  await db.periodLog.createMany({ data: periods, skipDuplicates: true })

  const logs = profiles.flatMap((p, i) =>
    Array.from({ length: 28 }, (_, n) => n).flatMap((n) => {
      if ((i + n) % 3 === 0 && n > 1) return []
      const [category, symptomId] = SYMPTOMS[(i + n) % SYMPTOMS.length]!
      return [{ id: `hbac-sl-${p.id}-${n}`, profileId: p.id, date: utcDay(now, n), category, symptomId, value: 'moderate' }]
    }),
  )
  await db.symptomLog.createMany({ data: logs, skipDuplicates: true })

  await db.prediction.createMany({
    data: profiles.map((p, i) => ({
      id: `hbac-pred-${p.id}`, profileId: p.id, tier: i % 3 === 0 ? ('ARIMA' as const) : ('AVERAGE' as const),
      nextPeriodStart: new Date(now.getTime() + (10 + i) * DAY), ovulationDay: new Date(now.getTime() - (2 - (i % 5)) * DAY),
      fertileStart: new Date(now.getTime() - (4 - (i % 5)) * DAY), fertileEnd: new Date(now.getTime() + (i % 5) * DAY),
      confidence: i % 3 === 0 ? 0.78 + (i % 4) / 100 : 0.56 + (i % 5) * 0.02,
    })),
    skipDuplicates: true,
  })

  await db.predictionAccuracySnapshot.createMany({
    data: Array.from({ length: 30 }, (_, n) => [
      { id: `hbac-mae-a-${n}`, date: utcDay(now, n), tier: 'AVERAGE', maeDays: Math.round((3.4 - n * 0.02 + (n % 4) * 0.1) * 10) / 10, sampleSize: 40 - n },
      { id: `hbac-mae-r-${n}`, date: utcDay(now, n), tier: 'ARIMA', maeDays: Math.round((2.2 - n * 0.015 + (n % 3) * 0.1) * 10) / 10, sampleSize: 12 - (n % 5) },
    ]).flat(),
    skipDuplicates: true,
  })
}
