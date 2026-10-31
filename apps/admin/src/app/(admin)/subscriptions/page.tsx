import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getSubscriptions,
  getSubscriptionTrend,
  getSubscriptionStatusBreakdown,
} from '@/app/queries/subscription-queries'
import { getLatestSubscriptionCheckRun } from '@/app/queries/system-queries'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import { SubscriptionsClient } from './SubscriptionsClient'

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const range = parseDateRange(params, new Date())
  const status = typeof params.status === 'string' ? params.status : undefined

  const [data, trend, statusBreakdown, latestRun] = await Promise.all([
    getSubscriptions({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      status,
      dateFrom: range.from,
      dateTo: range.to,
    }),
    getSubscriptionTrend(range),
    getSubscriptionStatusBreakdown(),
    getLatestSubscriptionCheckRun(),
  ])

  return (
    <SubscriptionsClient
      data={data}
      trend={trend}
      statusBreakdown={statusBreakdown}
      range={range}
      latestRun={latestRun}
      now={new Date()}
    />
  )
}
