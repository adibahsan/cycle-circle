import { prisma } from '../db'

/**
 * Return KPI counts for the admin dashboard.
 */
export async function getDashboardStats() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    activeUsers,
    totalProfiles,
    proSubscribers,
    dailyLogs,
    newUsersThisWeek,
    newUsersLastWeek,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: thirtyDaysAgo } } }),
    prisma.profile.count(),
    prisma.subscription.count({ where: { status: 'PRO' } }),
    prisma.periodLog.count({ where: { createdAt: { gte: new Date(now.toDateString()) } } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          lt: sevenDaysAgo,
        },
      },
    }),
  ])

  return {
    totalUsers,
    activeUsers,
    totalProfiles,
    proSubscribers,
    dailyLogs,
    newUsersThisWeek,
    newUsersLastWeek,
    userGrowth:
      newUsersLastWeek > 0
        ? Math.round(((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) * 100)
        : 0,
  }
}

/**
 * Return daily signup counts bucketed over the given number of days.
 * Every date in the range is pre-filled with zero so the chart has no gaps.
 */
export async function getUserTrend(days: number = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: startDate }, deletedAt: null },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Pre-fill every date bucket with zero
  const dailyCounts: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000)
    dailyCounts[date.toISOString().split('T')[0]] = 0
  }

  for (const user of users) {
    const dateKey = user.createdAt.toISOString().split('T')[0]
    if (dailyCounts[dateKey] !== undefined) dailyCounts[dateKey]++
  }

  return Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
}

/**
 * Return a histogram of cycle lengths across all profiles.
 */
export async function getCycleLengthDistribution() {
  const profiles = await prisma.profile.findMany({ select: { cycleLength: true } })

  const distribution: Record<number, number> = {}
  for (const p of profiles) {
    distribution[p.cycleLength] = (distribution[p.cycleLength] || 0) + 1
  }

  return Object.entries(distribution)
    .map(([length, count]) => ({ cycleLength: Number(length), count }))
    .sort((a, b) => a.cycleLength - b.cycleLength)
}

/**
 * Return symptom log counts grouped by category.
 */
export async function getSymptomsByCategory() {
  const logs = await prisma.symptomLog.groupBy({
    by: ['category'],
    _count: { id: true },
  })

  return logs.map(l => ({ category: l.category, count: l._count.id }))
}

/**
 * Return average prediction confidence grouped by tier.
 */
export async function getPredictionAccuracy() {
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
}

/**
 * Return weekly cohort retention over the past 8 weeks.
 * Each entry contains the cohort week start date, users created that week,
 * users retained (logged in within the last 7 days), and a retention rate.
 */
export async function getUserRetention() {
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
}
