import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireCurrentUser } from './auth-queries'
import { cacheTags, WEB_CACHE_TTL } from '@/lib/cache-tags'
import {
  getDashboardData as svcGetDashboardData,
  getCalendarData as svcGetCalendarData,
  listPeriodLogs,
  getEngagementSummary as svcGetEngagementSummary,
} from '@vesta/shared/server/services'

export const getDashboardData = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetDashboardData(profileId, user.id),
    ['dashboard', profileId],
    { tags: [cacheTags.tracking(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})

export const getCalendarData = cache(async (profileId: string, month: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetCalendarData(profileId, user.id, month),
    ['calendar', profileId, month],
    { tags: [cacheTags.tracking(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})

export const getPeriodLogs = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => listPeriodLogs(profileId, user.id),
    ['period-logs', profileId],
    { tags: [cacheTags.tracking(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})

export const getEngagementSummary = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetEngagementSummary(profileId, user.id),
    ['engagement-summary', profileId],
    { tags: [cacheTags.tracking(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})
