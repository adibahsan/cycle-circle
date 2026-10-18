'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { parseDhakaDay } from '@vesta/shared/utils/dhaka-date'
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
    // Date-only values are inclusive Asia/Dhaka days, matching the list.
    dateFrom: parseDhakaDay(filters?.dateFrom),
    dateTo: parseDhakaDay(filters?.dateTo, true),
  })
}

export async function exportUsersCsv() {
  const jwt = await requireAdminAuth()
  return generateUsersCsv(jwt.sub)
}
