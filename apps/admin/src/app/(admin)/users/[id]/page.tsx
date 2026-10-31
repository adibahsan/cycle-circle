import { notFound } from 'next/navigation'
import { requireAdminUser } from '@/app/queries/auth-queries'
import { getUserDetail } from '@/app/queries/user-queries'
import { getUserPlanHistory } from '@/app/queries/log-queries'
import { UserDetailClient } from './UserDetailClient'

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  await requireAdminUser()
  const [{ id }, { tab }] = await Promise.all([params, searchParams])
  // Log files are only read when the Plan history tab is open.
  const [user, planHistory] = await Promise.all([
    getUserDetail(id),
    tab === 'plan' ? getUserPlanHistory(id) : Promise.resolve(null),
  ])
  if (!user) notFound()
  return <UserDetailClient user={user} planHistory={planHistory} />
}
