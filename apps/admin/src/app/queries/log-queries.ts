import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { queryLogs, getPlanHistory, type LogQuery } from '@vesta/shared/server/services'

/** Logs are read live from disk (never cached): the page is for "what just happened". */
export const getLogs = cache(async (params: Omit<LogQuery, 'logDir'>) => {
  await requireAdminUser()
  return queryLogs(params)
})

/** Plan changes for one user from the translog (read live, like the logs page). */
export const getUserPlanHistory = cache(async (userId: string) => {
  await requireAdminUser()
  return getPlanHistory(userId)
})
