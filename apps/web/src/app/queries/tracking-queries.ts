import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireCurrentUser } from './auth-queries'
import {
  getDashboardData as svcGetDashboardData,
  getCalendarData as svcGetCalendarData,
  listPeriodLogs,
} from '@vesta/shared/server/services'

export const getDashboardData = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetDashboardData(profileId, user.id),
    ['dashboard', profileId],
    { tags: [`tracking:${profileId}`], revalidate: 300 }
  )()
})

export const getCalendarData = cache(async (profileId: string, month: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetCalendarData(profileId, user.id, month),
    ['calendar', profileId, month],
    { tags: [`tracking:${profileId}`], revalidate: 300 }
  )()
})

export const getPeriodLogs = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => listPeriodLogs(profileId, user.id),
    ['period-logs', profileId],
    { tags: [`tracking:${profileId}`], revalidate: 300 }
  )()
})
