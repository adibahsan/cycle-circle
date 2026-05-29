import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { listFeedback } from '@vesta/shared/server/services'

interface FeedbackListParams {
  page?: number
  pageSize?: number
  category?: string
  minRating?: number
}

export const getFeedbackList = cache(async (params: FeedbackListParams = {}) => {
  await requireAdminUser()
  return listFeedback(params)
})
