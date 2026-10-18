import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { queryLogs, getPlanHistory, ADMIN_LOG_CHANNELS, type LogQuery } from '@vesta/shared/server/services'

/** Logs are read live from disk (never cached): the page is for "what just happened". */
export const getLogs = cache(async (params: Omit<LogQuery, 'logDir'>) => {
  await requireAdminUser()
  // Admin sees merchant/webhook/translog only, whatever the caller asks for.
  const allowed = params.channels?.filter((c) => ADMIN_LOG_CHANNELS.includes(c))
  return queryLogs({ ...params, channels: allowed?.length ? allowed : [...ADMIN_LOG_CHANNELS] })
})

/** Plan changes for one user from the translog (read live, like the logs page). */
export const getUserPlanHistory = cache(async (userId: string) => {
  await requireAdminUser()
  return getPlanHistory(userId)
})
