import { requireAdminUser } from '@/app/queries/auth-queries'
import { getSubscriptions } from '@/app/queries/subscription-queries'
import { SubscriptionsClient } from './SubscriptionsClient'

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const data = await getSubscriptions({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 20,
    status: params.status,
  })
  return <SubscriptionsClient data={data} />
}
