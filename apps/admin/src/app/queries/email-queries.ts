import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  listEmailLogs,
  getEmailLogStats,
  getEmailLogById,
} from '@vesta/shared/server/services'
import type { EmailLogListParams } from '@vesta/shared/server/services'
import type { DateRange } from '@vesta/shared/utils/date-range'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

function emailLogsCacheKey(params: EmailLogListParams) {
  return [
    'admin-email-logs',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.status ?? '',
    params.type ?? '',
    params.deliveryStatus ?? '',
    params.userId ?? '',
    params.search ?? '',
    params.dateFrom?.toISOString() ?? '',
    params.dateTo?.toISOString() ?? '',
  ]
}

export const getEmailLogList = cache(async (params: EmailLogListParams = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listEmailLogs(params),
    emailLogsCacheKey(params),
    { tags: [adminCacheTags.emails], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getEmailLogStatsData = cache(async (range?: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => getEmailLogStats(range ? { dateFrom: range.from, dateTo: range.to } : {}),
    ['admin-email-log-stats', range?.key ?? 'all'],
    { tags: [adminCacheTags.emails], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getEmailLogDetail = cache(async (id: string) => {
  await requireAdminUser()
  return unstable_cache(
    () => getEmailLogById(id),
    ['admin-email-log', id],
    { tags: [adminCacheTags.emails], revalidate: ADMIN_CACHE_TTL }
  )()
})
