import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getCycleLengthDistribution,
  getSymptomsByCategory,
  getPredictionAccuracy,
  getUserRetention,
  getUserTrend,
  getPredictionMae,
} from '@/app/queries/analytics-queries'
import { AnalyticsClient } from './AnalyticsClient'

// Map the ?range= URL param to a number of days for getUserTrend.
const RANGE_TO_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export default async function AnalyticsPage({
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

  const [cycleLengths, symptoms, predictions, retention, trend, predictionMae] = await Promise.all([
    getCycleLengthDistribution(),
    getSymptomsByCategory(),
    getPredictionAccuracy(),
    getUserRetention(),
    getUserTrend(days),
    getPredictionMae(),
  ])

  return (
    <AnalyticsClient
      cycleLengths={cycleLengths}
      symptoms={symptoms}
      predictions={predictions}
      retention={retention}
      trend={trend}
      range={range}
      predictionMae={predictionMae}
    />
  )
}
