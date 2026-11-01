import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  listSubscriptions,
  getSubscriptionTrend as svcGetSubscriptionTrend,
  getSubscriptionStatusBreakdown as svcGetSubscriptionStatusBreakdown,
} from '@vesta/shared/server/services'
import type { DateRange } from '@vesta/shared/utils/date-range'
import { adminCacheTags, KPI_CACHE_TTL } from '@/lib/admin-cache-tags'

interface SubscriptionListParams {
  page?: number
  pageSize?: number
  status?: string
  dateFrom?: Date
  dateTo?: Date
}

function subscriptionsCacheKey(params: SubscriptionListParams) {
  return [
    'admin-subscriptions',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.status ?? '',
    params.dateFrom?.toISOString() ?? '',
    params.dateTo?.toISOString() ?? '',
  ]
}

export const getSubscriptions = cache(async (params: SubscriptionListParams = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listSubscriptions(params),
    subscriptionsCacheKey(params),
    { tags: [adminCacheTags.subscriptions], revalidate: KPI_CACHE_TTL }
  )()
})

export const getSubscriptionTrend = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSubscriptionTrend({ dateFrom: range.from, dateTo: range.to, now: new Date() }),
    ['admin-subscriptions-subscription-trend', range.key],
    { tags: [adminCacheTags.subscriptions], revalidate: KPI_CACHE_TTL }
  )()
})

export const getSubscriptionStatusBreakdown = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSubscriptionStatusBreakdown(),
    ['admin-subscription-status-breakdown'],
    { tags: [adminCacheTags.subscriptions], revalidate: KPI_CACHE_TTL }
  )()
})
