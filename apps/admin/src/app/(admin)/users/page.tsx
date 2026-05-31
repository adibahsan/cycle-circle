import { requireAdminUser } from '@/app/queries/auth-queries'
import { getUsers } from '@/app/queries/user-queries'
import { UsersClient } from './UsersClient'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const data = await getUsers({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 20,
    search: params.search,
    status: (params.status as 'all' | 'active' | 'suspended' | 'deleted') || 'active',
    sort: params.sort,
    order: (params.order as 'asc' | 'desc') || 'desc',
  })
  return <UsersClient data={data} />
}
