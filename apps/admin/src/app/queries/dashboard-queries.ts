import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireAdminUser } from './auth-queries'

export const getDashboardStats = cache(async () => {
  await requireAdminUser()

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
})

export const getUserTrend = cache(async (days: number = 30) => {
  await requireAdminUser()

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
})
