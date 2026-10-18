import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getSmsBroadcasts,
  getSmsSendHistory,
  getSmsDeliveryBreakdown,
  getNextSmsBroadcastId,
} from '@/app/queries/sms-queries'
import { SmsClient } from './SmsClient'

// Map ?range= URL param to number of days — mirrors AnalyticsPage
const RANGE_TO_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export default async function SmsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams

  // Resolve range — default to 30d
  const rawRange = params.range ?? '30d'
  const range = rawRange in RANGE_TO_DAYS ? rawRange : '30d'
  const days = RANGE_TO_DAYS[range]

  // Fetch all data in parallel
  const [data, sendHistory, deliveryBreakdown, nextSendId] = await Promise.all([
    getSmsBroadcasts({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      status: params.status ?? 'queue',
    }),
    getSmsSendHistory(days),
    getSmsDeliveryBreakdown(),
    getNextSmsBroadcastId(),
  ])

  return (
    <SmsClient
      data={data}
      sendHistory={sendHistory}
      deliveryBreakdown={deliveryBreakdown}
      range={range}
      nextSendId={nextSendId}
    />
  )
}
