import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import { listFeedback, getFeedbackById } from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

interface FeedbackListParams {
  page?: number
  pageSize?: number
  category?: string
  minRating?: number
  dateFrom?: Date
  dateTo?: Date
}

function feedbackCacheKey(params: FeedbackListParams) {
  return [
    'admin-feedback',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.category ?? '',
    String(params.minRating ?? ''),
    params.dateFrom?.toISOString() ?? '',
    params.dateTo?.toISOString() ?? '',
  ]
}

export const getFeedbackList = cache(async (params: FeedbackListParams = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listFeedback(params),
    feedbackCacheKey(params),
    { tags: [adminCacheTags.feedback], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getFeedbackDetail = cache(async (id: string) => {
  await requireAdminUser()
  return unstable_cache(
    () => getFeedbackById(id),
    ['admin-feedback-detail', id],
    { tags: [adminCacheTags.feedback], revalidate: ADMIN_CACHE_TTL }
  )()
})
