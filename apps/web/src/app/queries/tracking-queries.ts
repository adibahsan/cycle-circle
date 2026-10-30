import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { bangladeshToday } from '@vesta/shared/utils/dhaka-date'
import { requireCurrentUser } from './auth-queries'
import { cacheTags, WEB_CACHE_TTL } from '@/lib/cache-tags'
import {
  getDashboardData as svcGetDashboardData,
  getCalendarData as svcGetCalendarData,
  listPeriodLogs,
  getEngagementSummary as svcGetEngagementSummary,
} from '@vesta/shared/server/services'

/**
 * Bump when the dashboard data's shape or meaning changes, so the data cache never
 * serves an entry built by older code (v2: phasePattern added, shared phase names;
 * v3: symptomPattern for menopause).
 */
const DASHBOARD_CACHE_VERSION = 'dashboard-v3'

export const getDashboardData = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  const now = new Date()
  return unstable_cache(
    () => svcGetDashboardData(profileId, user.id, now),
    // The Bangladesh day is part of the key: the data counts days from "today", so an entry
    // built yesterday must not be served after midnight.
    [DASHBOARD_CACHE_VERSION, profileId, bangladeshToday(now)],
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
