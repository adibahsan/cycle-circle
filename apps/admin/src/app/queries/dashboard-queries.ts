import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  getDashboardStats as svcGetDashboardStats,
  getUserTrend as svcGetUserTrend,
  getUserSignupTrend as svcGetUserSignupTrend,
  getSubscriptionTrend as svcGetSubscriptionTrend,
  getLatestPredictionMae as svcGetLatestPredictionMae,
} from '@vesta/shared/server/services'
import { adminCacheTags, DASHBOARD_CACHE_TTL } from '@/lib/admin-cache-tags'

export const getDashboardStats = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetDashboardStats(),
    ['admin-dashboard-stats'],
    { tags: [adminCacheTags.dashboard], revalidate: DASHBOARD_CACHE_TTL }
  )()
})

export const getUserTrend = cache(async (days: number = 30) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserTrend(days),
    ['admin-dashboard-user-trend', String(days)],
    { tags: [adminCacheTags.dashboard], revalidate: DASHBOARD_CACHE_TTL }
  )()
})

export const getUserSignupTrend = cache(async (days: number = 30) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserSignupTrend({ days, now: new Date() }),
    ['admin-dashboard-user-signup-trend', String(days)],
    { tags: [adminCacheTags.dashboard], revalidate: DASHBOARD_CACHE_TTL }
  )()
})

export const getSubscriptionTrend = cache(async (days: number = 30) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSubscriptionTrend({ days, now: new Date() }),
    ['admin-dashboard-subscription-trend', String(days)],
    { tags: [adminCacheTags.dashboard], revalidate: DASHBOARD_CACHE_TTL }
  )()
})

export const getPredictionMaeSummary = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetLatestPredictionMae(),
    ['admin-dashboard-prediction-mae'],
    { tags: [adminCacheTags.dashboard], revalidate: DASHBOARD_CACHE_TTL }
  )()
})
