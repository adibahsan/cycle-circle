'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { generateFeedbackCsv, generateUsersCsv } from '@vesta/shared/server/services'

export async function exportFeedbackCsv(filters?: {
  category?: string
  rating?: number
  minRating?: number
  search?: string
  dateFrom?: string
  dateTo?: string
}) {
  const jwt = await requireAdminAuth()
  return generateFeedbackCsv(jwt.sub, {
    category: filters?.category,
    rating: filters?.rating,
    minRating: filters?.minRating,
    search: filters?.search,
    // Date-only values (YYYY-MM-DD): from = start of day, to = end of day (UTC), matching the list.
    dateFrom: filters?.dateFrom ? new Date(`${filters.dateFrom.slice(0, 10)}T00:00:00.000Z`) : undefined,
    dateTo: filters?.dateTo ? new Date(`${filters.dateTo.slice(0, 10)}T23:59:59.999Z`) : undefined,
  })
}

export async function exportUsersCsv() {
  const jwt = await requireAdminAuth()
  return generateUsersCsv(jwt.sub)
}
