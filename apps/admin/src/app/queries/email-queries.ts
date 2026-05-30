import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import {
  listEmailLogs,
  getEmailLogStats,
  getEmailLogById,
} from '@vesta/shared/server/services'
import type { EmailLogListParams } from '@vesta/shared/server/services'

export const getEmailLogList = cache(async (params: EmailLogListParams = {}) => {
  await requireAdminUser()
  return listEmailLogs(params)
})

export const getEmailLogStatsData = cache(async () => {
  await requireAdminUser()
  return getEmailLogStats()
})

export const getEmailLogDetail = cache(async (id: string) => {
  await requireAdminUser()
  return getEmailLogById(id)
})
