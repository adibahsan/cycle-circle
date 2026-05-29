'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { generateFeedbackCsv, generateUsersCsv } from '@vesta/shared/server/services'

export async function exportFeedbackCsv() {
  await requireAdminAuth()
  return generateFeedbackCsv()
}

export async function exportUsersCsv() {
  await requireAdminAuth()
  return generateUsersCsv()
}
