export const dynamic = 'force-dynamic'

import { requireAdminUser } from '@/app/queries/auth-queries'
import { getDashboardStats, getUserTrend } from '@/app/queries/dashboard-queries'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  await requireAdminUser()
  const [stats, userTrend] = await Promise.all([
    getDashboardStats(),
    getUserTrend(30),
  ])
  return <DashboardClient stats={stats} userTrend={userTrend} />
}
