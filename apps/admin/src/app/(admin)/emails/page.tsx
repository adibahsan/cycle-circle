import { requireAdminUser } from '@/app/queries/auth-queries'
import { getEmailLogList, getEmailLogStatsData } from '@/app/queries/email-queries'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import { EmailsClient } from './EmailsClient'

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const range = parseDateRange(params, new Date())
  const one = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined)

  const [data, stats] = await Promise.all([
    getEmailLogList({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      type: one('type'),
      status: one('status'),
      deliveryStatus: one('deliveryStatus'),
      search: one('search'),
      dateFrom: range.from,
      dateTo: range.to,
    }),
    getEmailLogStatsData(range),
  ])

  return <EmailsClient data={data} stats={stats} range={range} />
}
