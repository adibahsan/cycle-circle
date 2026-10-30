import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  listBroadcasts,
  getNextScheduledBroadcastId,
  getSmsSendHistory as svcGetSmsSendHistory,
  getSmsDeliveryBreakdown as svcGetSmsDeliveryBreakdown,
} from '@vesta/shared/server/services'
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

export const getSmsSendHistory = cache(async (days: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSmsSendHistory({ days, now: new Date() }),
    ['admin-sms-send-history', String(days)],
    { tags: [adminCacheTags.sms], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getSmsDeliveryBreakdown = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSmsDeliveryBreakdown(),
    ['admin-sms-delivery-breakdown'],
    { tags: [adminCacheTags.sms], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getNextSmsBroadcastId = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => getNextScheduledBroadcastId(),
    ['admin-sms-next-send'],
    { tags: [adminCacheTags.sms], revalidate: ADMIN_CACHE_TTL }
  )()
})
