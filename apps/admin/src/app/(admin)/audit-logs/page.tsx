import { requireAdminUser } from '@/app/queries/auth-queries'
import { getAuditLogs } from '@/app/queries/audit-queries'
import { AuditLogClient } from './AuditLogClient'

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const data = await getAuditLogs({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 20,
    action: params.action || undefined,
    targetType: params.targetType || undefined,
  })
  return <AuditLogClient data={data} />
}
