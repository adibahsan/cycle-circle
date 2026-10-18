import { prisma } from './db'
import { logger } from './log'
import { MS_PER_DAY } from '../utils/cycle-utils'

export const TIER2_MIN_CYCLES = 6

export async function recalculatePrediction(profileId: string) {
  const logs = await prisma.periodLog.findMany({
    where: { profileId },
    orderBy: { startDate: 'asc' }
  })

  if (logs.length === 0) return

  const cycleLengths: number[] = []
  for (let i = 1; i < logs.length; i++) {
    const diff = Math.round((logs[i].startDate.getTime() - logs[i-1].startDate.getTime()) / MS_PER_DAY)
    if (diff > 0 && diff < 90) cycleLengths.push(diff)
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile) return

  const tier = cycleLengths.length >= TIER2_MIN_CYCLES ? 'ARIMA' : 'AVERAGE'

  let avgCycle: number
  if (tier === 'ARIMA' && cycleLengths.length >= TIER2_MIN_CYCLES) {
    const recent = cycleLengths.slice(-6)
    const weights = [1, 1.5, 2, 2.5, 3, 3.5]
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    avgCycle = Math.round(recent.reduce((sum, len, i) => sum + len * weights[i], 0) / totalWeight)
  } else {
    avgCycle = cycleLengths.length > 0
      ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
      : profile.cycleLength
  }

  const lastLog = logs[logs.length - 1]
  const nextPeriodStart = new Date(lastLog.startDate)
  nextPeriodStart.setDate(nextPeriodStart.getDate() + avgCycle)

  const ovulationDay = new Date(nextPeriodStart)
  ovulationDay.setDate(ovulationDay.getDate() - 14)

  const fertileStart = new Date(ovulationDay)
  fertileStart.setDate(fertileStart.getDate() - 5)

  const fertileEnd = new Date(ovulationDay)
  fertileEnd.setDate(fertileEnd.getDate() + 1)

  const confidence = Math.min(0.95, 0.5 + cycleLengths.length * 0.05)

  await prisma.prediction.upsert({
    where: { profileId },
    update: { tier, nextPeriodStart, ovulationDay, fertileStart, fertileEnd, confidence },
    create: { profileId, tier, nextPeriodStart, ovulationDay, fertileStart, fertileEnd, confidence }
  })

  logger.customer('prediction.updated', { profileId, tier, confidence })
}
