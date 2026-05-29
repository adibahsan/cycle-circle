export const dynamic = 'force-dynamic'

import { requireAdminUser } from '@/app/queries/auth-queries'
import { getSmsBroadcasts } from '@/app/queries/sms-queries'
import { SmsClient } from './SmsClient'

export default async function SmsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const data = await getSmsBroadcasts({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 20,
    status: params.status,
  })
  return <SmsClient data={data} />
}
