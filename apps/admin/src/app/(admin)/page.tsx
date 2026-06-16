import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getDashboardStats,
  getUserTrend,
  getUserSignupTrend,
  getSubscriptionTrend,
} from '@/app/queries/dashboard-queries'
import { DashboardClient } from './DashboardClient'

const RANGE_MAP: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const range = params.range ?? '30d'
  const days = RANGE_MAP[range] ?? 30

  const [stats, userTrend, signupTrend, subscriptionTrend] = await Promise.all([
    getDashboardStats(),
    getUserTrend(days),
    getUserSignupTrend(days),
    getSubscriptionTrend(days),
  ])

  return (
    <DashboardClient
      stats={stats}
      userTrend={userTrend}
      signupTrend={signupTrend}
      subscriptionTrend={subscriptionTrend}
      range={range}
    />
  )
}
