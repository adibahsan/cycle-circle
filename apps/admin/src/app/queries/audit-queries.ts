import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import { listAuditLogs } from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

interface AuditLogListParams {
  page?: number
  pageSize?: number
  action?: string
  targetType?: string
  search?: string
}

function auditLogsCacheKey(params: AuditLogListParams) {
  return [
    'admin-audit-logs',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.action ?? '',
    params.targetType ?? '',
    params.search ?? '',
  ]
}

export const getAuditLogs = cache(async (params: AuditLogListParams = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listAuditLogs(params),
    auditLogsCacheKey(params),
    { tags: [adminCacheTags.auditLogs], revalidate: ADMIN_CACHE_TTL }
  )()
})
