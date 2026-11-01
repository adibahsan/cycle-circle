import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  getOverviewMetrics as svcGetOverviewMetrics,
  getUserSignupTrend as svcGetUserSignupTrend,
} from '@vesta/shared/server/services'
import type { DateRange } from '@vesta/shared/utils/date-range'
import { adminCacheTags, DASHBOARD_CACHE_TTL } from '@/lib/admin-cache-tags'

/** The Overview's headline numbers for a range, at most a minute old. */
export const getOverviewMetrics = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    async () => ({
      generatedAt: new Date().toISOString(),
      metrics: await svcGetOverviewMetrics(range, new Date()),
    }),
    ['admin-overview-metrics', range.key],
    { tags: [adminCacheTags.dashboard], revalidate: DASHBOARD_CACHE_TTL },
  )()
})

export const getUserSignupTrend = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserSignupTrend({ dateFrom: range.from, dateTo: range.to, now: new Date() }),
    ['admin-overview-signup-trend', range.key],
    { tags: [adminCacheTags.dashboard], revalidate: DASHBOARD_CACHE_TTL },
  )()
})
