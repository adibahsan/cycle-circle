import { cache } from 'react'
import { requireCurrentUser } from './auth-queries'
import {
  getDashboardData as svcGetDashboardData,
  getCalendarData as svcGetCalendarData,
  listPeriodLogs,
} from '@vesta/shared/server/services'

export const getDashboardData = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return svcGetDashboardData(profileId, user.id)
})

export const getCalendarData = cache(async (profileId: string, month: string) => {
  const user = await requireCurrentUser()
  return svcGetCalendarData(profileId, user.id, month)
})

export const getPeriodLogs = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return listPeriodLogs(profileId, user.id)
})
