'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { toFeedbackQuery, type FeedbackFilters } from '@vesta/shared/utils/feedback-filters'
import { generateFeedbackCsv, generateUsersCsv } from '@vesta/shared/server/services'

export async function exportFeedbackCsv(filters: FeedbackFilters = {}) {
  const jwt = await requireAdminAuth()
  return generateFeedbackCsv(jwt.sub, toFeedbackQuery(filters))
}

export async function exportUsersCsv() {
  const jwt = await requireAdminAuth()
  return generateUsersCsv(jwt.sub)
}
