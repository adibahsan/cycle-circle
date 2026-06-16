import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getUsers,
  getUserSignupTrendQuery,
  getAuthMethodDistributionQuery,
  getSubscriptionStatusDistributionQuery,
  getLanguageDistributionQuery,
  getUserStatusBreakdownQuery,
} from '@/app/queries/user-queries'
import { UsersClient } from './UsersClient'

const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams

  const range = params.range ?? '30d'
  const days = RANGE_DAYS[range] ?? 30

  const [data, signupTrend, authMethodDist, subscriptionDist, languageDist, statusBreakdown] =
    await Promise.all([
      getUsers({
        page: Number(params.page) || 1,
        pageSize: Number(params.pageSize) || 20,
        search: params.search,
        status: (params.status as 'all' | 'active' | 'suspended' | 'deleted') || 'active',
        sort: params.sort,
        order: (params.order as 'asc' | 'desc') || 'desc',
      }),
      getUserSignupTrendQuery(days),
      getAuthMethodDistributionQuery(),
      getSubscriptionStatusDistributionQuery(),
      getLanguageDistributionQuery(),
      getUserStatusBreakdownQuery(),
    ])

  return (
    <UsersClient
      data={data}
      range={range}
      signupTrend={signupTrend}
      authMethodDist={authMethodDist}
      subscriptionDist={subscriptionDist}
      languageDist={languageDist}
      statusBreakdown={statusBreakdown}
    />
  )
}
