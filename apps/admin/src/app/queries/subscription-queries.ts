import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { listSubscriptions } from '@vesta/shared/server/services'

interface SubscriptionListParams {
  page?: number
  pageSize?: number
  status?: string
}

export const getSubscriptions = cache(async (params: SubscriptionListParams = {}) => {
  await requireAdminUser()
  return listSubscriptions(params)
})
