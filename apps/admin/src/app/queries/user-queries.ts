import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import {
  listUsers,
  getUserDetailForAdmin,
  getUserSignupTrend,
  getAuthMethodDistribution,
  getSubscriptionStatusDistribution,
  getLanguageDistribution,
  getUserStatusBreakdown,
  type ListUsersParams,
} from '@vesta/shared/server/services'
import { requireAdminUser } from './auth-queries'
import { adminCacheTags, ADMIN_CACHE_TTL, KPI_CACHE_TTL } from '@/lib/admin-cache-tags'

function usersCacheKey(params: ListUsersParams) {
  return [
    'admin-users',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.status ?? '',
    params.search ?? '',
    params.role ?? '',
    params.sort ?? '',
    params.order ?? '',
  ]
}

export const getUsers = cache(async (params: ListUsersParams = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listUsers(params),
    usersCacheKey(params),
    { tags: [adminCacheTags.users], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getUserDetail = cache(async (userId: string) => {
  await requireAdminUser()
  return unstable_cache(
    () => getUserDetailForAdmin(userId),
    ['admin-user-detail', userId],
    { tags: [adminCacheTags.user(userId), adminCacheTags.users], revalidate: ADMIN_CACHE_TTL }
  )()
})

// ── User chart aggregations ──────────────────────────────────────────────────

export const getUserSignupTrendQuery = cache(async (days: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => getUserSignupTrend({ days, now: new Date() }),
    ['admin-users-signup-trend', String(days)],
    { tags: [adminCacheTags.users], revalidate: KPI_CACHE_TTL }
  )()
})

export const getAuthMethodDistributionQuery = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => getAuthMethodDistribution(),
    ['admin-user-auth-method-dist'],
    { tags: [adminCacheTags.users], revalidate: KPI_CACHE_TTL }
  )()
})

export const getSubscriptionStatusDistributionQuery = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => getSubscriptionStatusDistribution(),
    ['admin-user-subscription-dist'],
    { tags: [adminCacheTags.users], revalidate: KPI_CACHE_TTL }
  )()
})

export const getLanguageDistributionQuery = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => getLanguageDistribution(),
    ['admin-user-language-dist'],
    { tags: [adminCacheTags.users], revalidate: KPI_CACHE_TTL }
  )()
})

export const getUserStatusBreakdownQuery = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => getUserStatusBreakdown(),
    ['admin-user-status-breakdown'],
    { tags: [adminCacheTags.users], revalidate: KPI_CACHE_TTL }
  )()
})
