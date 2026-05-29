import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireAdminUser } from './auth-queries'

export const getCycleLengthDistribution = cache(async () => {
  await requireAdminUser()

  const profiles = await prisma.profile.findMany({ select: { cycleLength: true } })

  const distribution: Record<number, number> = {}
  for (const p of profiles) {
    distribution[p.cycleLength] = (distribution[p.cycleLength] || 0) + 1
  }

  return Object.entries(distribution)
    .map(([length, count]) => ({ cycleLength: Number(length), count }))
    .sort((a, b) => a.cycleLength - b.cycleLength)
})

export const getSymptomsByCategory = cache(async () => {
  await requireAdminUser()

  const logs = await prisma.symptomLog.groupBy({
    by: ['category'],
    _count: { id: true },
  })

  return logs.map(l => ({ category: l.category, count: l._count.id }))
})

export const getPredictionAccuracy = cache(async () => {
  await requireAdminUser()

  const predictions = await prisma.prediction.groupBy({
    by: ['tier'],
    _count: { id: true },
    _avg: { confidence: true },
  })

  return predictions.map(p => ({
    tier: p.tier,
    count: p._count.id,
    avgConfidence: Math.round((p._avg.confidence ?? 0) * 100) / 100,
  }))
})

export const getUserRetention = cache(async () => {
  await requireAdminUser()

  const weeks = 8
  const cohorts = []

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(Date.now() - (weeks - i) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [created, retained] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: weekStart, lt: weekEnd }, deletedAt: null },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          deletedAt: null,
          lastLoginAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    cohorts.push({
      week: weekStart.toISOString().split('T')[0],
      created,
      retained,
      rate: created > 0 ? Math.round((retained / created) * 100) : 0,
    })
  }

  return cohorts
})
