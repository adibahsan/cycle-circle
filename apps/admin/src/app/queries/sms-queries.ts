import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { listBroadcasts } from '@vesta/shared/server/services'

interface SmsBroadcastListParams {
  page?: number
  pageSize?: number
  status?: string
}

export const getSmsBroadcasts = cache(async (params: SmsBroadcastListParams = {}) => {
  await requireAdminUser()
  return listBroadcasts(params)
})
