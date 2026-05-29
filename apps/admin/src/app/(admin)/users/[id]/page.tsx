import { requireAdminUser } from '@/app/queries/auth-queries'
import { getUserDetail } from '@/app/queries/user-queries'
import { UserDetailClient } from './UserDetailClient'

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const { id } = await params
  const user = await getUserDetail(id)
  return <UserDetailClient user={user} />
}
