import { requireAdminUser } from '@/app/queries/auth-queries'
import { getOverviewMetrics, getUserSignupTrend } from '@/app/queries/dashboard-queries'
import { getPredictionMaeTrend } from '@/app/queries/analytics-queries'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import { OverviewClient } from './OverviewClient'

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()

  const range = parseDateRange(await searchParams, new Date())

  const [overview, signupTrend, maeTrend] = await Promise.all([
    getOverviewMetrics(range),
    getUserSignupTrend(range),
    getPredictionMaeTrend(range),
  ])

  return (
    <OverviewClient
      generatedAt={overview.generatedAt}
      metrics={overview.metrics}
      signupTrend={signupTrend}
      maeTrend={maeTrend}
      range={{ kind: range.kind, preset: range.preset, fromDay: range.fromDay, toDay: range.toDay, error: range.error }}
    />
  )
}
