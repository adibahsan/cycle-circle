import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import { getDashboardStats as svcGetDashboardStats, getUserTrend as svcGetUserTrend } from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

export const getDashboardStats = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetDashboardStats(),
    ['admin-dashboard-stats'],
    { tags: [adminCacheTags.dashboard], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getUserTrend = cache(async (days: number = 30) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserTrend(days),
    ['admin-user-trend', String(days)],
    { tags: [adminCacheTags.dashboard], revalidate: ADMIN_CACHE_TTL }
  )()
})
