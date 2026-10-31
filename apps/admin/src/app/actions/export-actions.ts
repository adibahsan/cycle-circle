'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { toFeedbackQuery, type FeedbackFilters } from '@vesta/shared/utils/feedback-filters'
import { generateFeedbackCsv, generateUsersCsv } from '@vesta/shared/server/services'

export async function exportFeedbackCsv(filters: FeedbackFilters = {}) {
  const jwt = await requireAdminAuth()
  return generateFeedbackCsv(jwt.sub, toFeedbackQuery(filters))
}

const USER_STATUSES = ['all', 'active', 'suspended', 'deleted'] as const

export async function exportUsersCsv(filters: { search?: string; status?: string } = {}) {
  const jwt = await requireAdminAuth()
  const status = USER_STATUSES.find((s) => s === filters.status)
  return generateUsersCsv(jwt.sub, { search: filters.search, status })
}
