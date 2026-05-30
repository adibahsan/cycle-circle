import { requireAdminUser } from '@/app/queries/auth-queries'
import { getEmailLogList, getEmailLogStatsData } from '@/app/queries/email-queries'
import { EmailsClient } from './EmailsClient'

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams

  const [data, stats] = await Promise.all([
    getEmailLogList({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      type: params.type,
      status: params.status,
      deliveryStatus: params.deliveryStatus,
      search: params.search,
    }),
    getEmailLogStatsData(),
  ])

  return <EmailsClient data={data} stats={stats} />
}
