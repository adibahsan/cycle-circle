import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getDailyActiveLoggers,
  getDailyActiveUsers,
  getSymptomLoggingRate,
  getLoggingStreakDistribution,
  getLoggingRetention,
} from '@/app/queries/analytics-queries'
import { EngagementClient } from './EngagementClient'

const RANGE_TO_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export default async function EngagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()

  const resolvedParams = await searchParams
  const rawRange = Array.isArray(resolvedParams.range)
    ? resolvedParams.range[0]
    : (resolvedParams.range ?? '30d')
  const range = rawRange in RANGE_TO_DAYS ? rawRange : '30d'
  const days = RANGE_TO_DAYS[range]

  const [activeUsers, activeLoggers, loggingRate, streakDistribution, retention] = await Promise.all([
    getDailyActiveUsers(days),
    getDailyActiveLoggers(days),
    getSymptomLoggingRate(days),
    getLoggingStreakDistribution(),
    getLoggingRetention(),
  ])

  return (
    <EngagementClient
      activeUsers={activeUsers}
      activeLoggers={activeLoggers}
      loggingRate={loggingRate}
      streakDistribution={streakDistribution}
      retention={retention}
      range={range}
    />
  )
}
