import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  listFeedback,
  getFeedbackById,
  getFeedbackVolumeByDate,
  getFeedbackByCategory,
  getFeedbackRatingDistribution,
} from '@vesta/shared/server/services'
import type { DateRange } from '@vesta/shared/utils/date-range'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

interface FeedbackListParams {
  page?: number
  pageSize?: number
  category?: string
  rating?: number
  minRating?: number
  search?: string
  dateFrom?: Date
  dateTo?: Date
}

function feedbackCacheKey(params: FeedbackListParams) {
  return [
    'admin-feedback',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.category ?? '',
    String(params.rating ?? ''),
    String(params.minRating ?? ''),
    params.search ?? '',
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

const feedbackWindow = (w: DateRange) => ({ dateFrom: w.from, dateTo: w.to, now: new Date() })

export const getFeedbackVolume = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => getFeedbackVolumeByDate(feedbackWindow(range)),
    ['admin-feedback-volume', range.key],
    { tags: [adminCacheTags.feedback], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getFeedbackCategories = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => getFeedbackByCategory(feedbackWindow(range)),
    ['admin-feedback-categories', range.key],
    { tags: [adminCacheTags.feedback], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getFeedbackRatings = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => getFeedbackRatingDistribution(feedbackWindow(range)),
    ['admin-feedback-ratings', range.key],
    { tags: [adminCacheTags.feedback], revalidate: ADMIN_CACHE_TTL }
  )()
})
