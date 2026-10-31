import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { listSubscriptionCheckRuns, getSubscriptionCheckRun } from '@vesta/shared/server/services'

/** The last 30 runs of the daily subscription check, newest first. */
export const getSubscriptionCheckHistory = cache(async () => {
  await requireAdminUser()
  return listSubscriptionCheckRuns(30)
})

/** The newest run of the daily subscription check, or null when it has never run. */
export const getLatestSubscriptionCheckRun = cache(async () => {
  await requireAdminUser()
  return (await listSubscriptionCheckRuns(1))[0] ?? null
})

export const getSubscriptionCheckRunDetail = cache(async (id: string) => {
  await requireAdminUser()
  return getSubscriptionCheckRun(id)
})
