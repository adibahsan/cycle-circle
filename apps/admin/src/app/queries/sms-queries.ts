import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import { listBroadcasts } from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

interface SmsBroadcastListParams {
  page?: number
  pageSize?: number
  status?: string
}

function smsCacheKey(params: SmsBroadcastListParams) {
  return [
    'admin-sms',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.status ?? '',
  ]
}

export const getSmsBroadcasts = cache(async (params: SmsBroadcastListParams = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listBroadcasts(params),
    smsCacheKey(params),
    { tags: [adminCacheTags.sms], revalidate: ADMIN_CACHE_TTL }
  )()
})
