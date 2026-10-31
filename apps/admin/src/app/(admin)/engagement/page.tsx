import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getDailyActiveLoggers,
  getDailyActiveUsers,
  getSymptomLoggingRate,
  getLoggingStreakDistribution,
  getLoggingRetention,
} from '@/app/queries/analytics-queries'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import { EngagementClient } from './EngagementClient'

export default async function EngagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()

  const range = parseDateRange(await searchParams, new Date())

  const [activeUsers, activeLoggers, loggingRate, streakDistribution, retention] = await Promise.all([
    getDailyActiveUsers(range),
    getDailyActiveLoggers(range),
    getSymptomLoggingRate(range),
    getLoggingStreakDistribution(range),
    getLoggingRetention(range),
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
