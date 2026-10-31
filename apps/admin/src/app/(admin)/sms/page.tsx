import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getSmsCampaigns,
  getSmsSendHistory,
  getSmsDeliveryBreakdown,
  getNextSmsCampaignId,
} from '@/app/queries/sms-queries'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import { SmsClient } from './SmsClient'

export default async function SmsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()
  const params = await searchParams

  const range = parseDateRange(params, new Date())
  const one = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined)

  // Fetch all data in parallel
  const [data, sendHistory, deliveryBreakdown, nextSendId] = await Promise.all([
    getSmsCampaigns({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      status: one('status') ?? 'all',
      q: one('q')?.trim().slice(0, 100) || undefined,
    }),
    getSmsSendHistory(range),
    getSmsDeliveryBreakdown(),
    getNextSmsCampaignId(),
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
