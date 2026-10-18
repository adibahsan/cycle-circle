import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getSubscriptions,
  getSubscriptionTrend,
  getSubscriptionStatusBreakdown,
} from '@/app/queries/subscription-queries'
import { SubscriptionsClient } from './SubscriptionsClient'

const RANGE_TO_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const range = params.range ?? '30d'
  const days = RANGE_TO_DAYS[range] ?? 30

  const [data, trend, statusBreakdown] = await Promise.all([
    getSubscriptions({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      status: params.status,
    }),
    getSubscriptionTrend(days),
    getSubscriptionStatusBreakdown(),
  ])

  return (
    <SubscriptionsClient
      data={data}
      trend={trend}
      statusBreakdown={statusBreakdown}
      range={range}
    />
  )
}
