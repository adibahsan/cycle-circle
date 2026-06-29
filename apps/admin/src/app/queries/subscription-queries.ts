import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  listSubscriptions,
  getSubscriptionTrend as svcGetSubscriptionTrend,
  getSubscriptionStatusBreakdown as svcGetSubscriptionStatusBreakdown,
  getCaasResultDistribution as svcGetCaasResultDistribution,
} from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

interface SubscriptionListParams {
  page?: number
  pageSize?: number
  status?: string
}

function subscriptionsCacheKey(params: SubscriptionListParams) {
  return [
    'admin-subscriptions',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.status ?? '',
  ]
}

export const getSubscriptions = cache(async (params: SubscriptionListParams = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listSubscriptions(params),
    subscriptionsCacheKey(params),
    { tags: [adminCacheTags.subscriptions], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getSubscriptionTrend = cache(async (days: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSubscriptionTrend({ days }),
    ['admin-subscriptions-subscription-trend', String(days)],
    { tags: [adminCacheTags.subscriptions], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getSubscriptionStatusBreakdown = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSubscriptionStatusBreakdown(),
    ['admin-subscription-status-breakdown'],
    { tags: [adminCacheTags.subscriptions], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getCaasResultDistribution = cache(async (days: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetCaasResultDistribution({ days }),
    ['admin-caas-result-distribution', String(days)],
    { tags: [adminCacheTags.subscriptions], revalidate: ADMIN_CACHE_TTL }
  )()
})
