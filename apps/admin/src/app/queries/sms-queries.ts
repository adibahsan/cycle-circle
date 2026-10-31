import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  listCampaigns,
  getCampaign as svcGetCampaign,
  getNextPlannedCampaignId,
  getSmsSendHistory as svcGetSmsSendHistory,
  getSmsDeliveryBreakdown as svcGetSmsDeliveryBreakdown,
} from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL, KPI_CACHE_TTL } from '@/lib/admin-cache-tags'

interface SmsCampaignListParams {
  page?: number
  pageSize?: number
  status?: string
}

function smsCacheKey(params: SmsCampaignListParams) {
  return ['admin-sms-campaigns', String(params.page ?? 1), String(params.pageSize ?? 20), params.status ?? '']
}

// The cron (a different process) sends messages without telling this app, so the campaign views
// use the short KPI TTL: the list is never more than a minute stale after a cron send.
export const getSmsCampaigns = cache(async (params: SmsCampaignListParams = {}) => {
  await requireAdminUser()
  return unstable_cache(() => listCampaigns(params), smsCacheKey(params), {
    tags: [adminCacheTags.sms],
    revalidate: KPI_CACHE_TTL,
  })()
})

export const getSmsCampaign = cache(async (id: string) => {
  await requireAdminUser()
  return unstable_cache(() => svcGetCampaign(id), ['admin-sms-campaign', id], {
    tags: [adminCacheTags.sms],
    revalidate: KPI_CACHE_TTL,
  })()
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
    { tags: [adminCacheTags.sms], revalidate: KPI_CACHE_TTL }
  )()
})

export const getNextSmsCampaignId = cache(async () => {
  await requireAdminUser()
  return unstable_cache(() => getNextPlannedCampaignId(), ['admin-sms-next-send'], {
    tags: [adminCacheTags.sms],
    revalidate: KPI_CACHE_TTL,
  })()
})
