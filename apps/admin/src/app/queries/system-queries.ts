import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { listSubscriptionCheckRuns, getSubscriptionCheckRun } from '@vesta/shared/server/services'

/** The last 30 runs of the daily subscription check, newest first. */
export const getSubscriptionCheckHistory = cache(async () => {
  await requireAdminUser()
  return listSubscriptionCheckRuns(30)
})

export const getSubscriptionCheckRunDetail = cache(async (id: string) => {
  await requireAdminUser()
  return getSubscriptionCheckRun(id)
})
