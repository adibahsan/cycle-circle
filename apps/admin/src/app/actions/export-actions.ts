'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { generateFeedbackCsv, generateUsersCsv } from '@vesta/shared/server/services'

export async function exportFeedbackCsv(filters?: {
  category?: string
  minRating?: number
  dateFrom?: string
  dateTo?: string
}) {
  const jwt = await requireAdminAuth()
  return generateFeedbackCsv(jwt.sub, {
    category: filters?.category,
    minRating: filters?.minRating,
    dateFrom: filters?.dateFrom ? new Date(filters.dateFrom) : undefined,
    dateTo: filters?.dateTo ? new Date(filters.dateTo) : undefined,
  })
}

export async function exportUsersCsv() {
  const jwt = await requireAdminAuth()
  return generateUsersCsv(jwt.sub)
}
