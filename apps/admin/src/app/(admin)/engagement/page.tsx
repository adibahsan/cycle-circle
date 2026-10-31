import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getDailyActiveLoggers,
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

  const [activeLoggers, loggingRate, streakDistribution, retention] = await Promise.all([
    getDailyActiveLoggers(range),
    getSymptomLoggingRate(range),
    getLoggingStreakDistribution(range),
    getLoggingRetention(range),
  ])

  return (
    <EngagementClient
      activeLoggers={activeLoggers}
      loggingRate={loggingRate}
      streakDistribution={streakDistribution}
      retention={retention}
      range={range}
    />
  )
}
