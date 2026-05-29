import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { getDashboardStats as svcGetDashboardStats, getUserTrend as svcGetUserTrend } from '@vesta/shared/server/services'

export const getDashboardStats = cache(async () => {
  await requireAdminUser()
  return svcGetDashboardStats()
})

export const getUserTrend = cache(async (days: number = 30) => {
  await requireAdminUser()
  return svcGetUserTrend(days)
})
