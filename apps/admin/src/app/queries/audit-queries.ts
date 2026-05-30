import { cache } from 'react'
import { requireAdminUser } from './auth-queries'
import { listAuditLogs } from '@vesta/shared/server/services'

interface AuditLogListParams {
  page?: number
  pageSize?: number
  action?: string
  targetType?: string
}

export const getAuditLogs = cache(async (params: AuditLogListParams = {}) => {
  await requireAdminUser()
  return listAuditLogs(params)
})
