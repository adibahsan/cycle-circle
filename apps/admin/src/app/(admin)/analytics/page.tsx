import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getCycleLengthDistribution,
  getSymptomsByCategory,
  getPredictionAccuracy,
  getUserRetention,
  getUserTrend,
  getPredictionMae,
  getSymptomsByPhase,
} from '@/app/queries/analytics-queries'
import {
  getFeedbackVolume,
  getFeedbackCategories,
  getFeedbackRatings,
} from '@/app/queries/feedback-queries'
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

  // Fixed windows until #103 adds per-panel ranges; day-aligned so cache keys are stable.
  const DAY_MS = 24 * 60 * 60 * 1000
  const dayEnd = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS + DAY_MS - 1)

  const [
    cycleLengths,
    symptoms,
    predictions,
    retention,
    trend,
    predictionMae,
    feedbackVolume,
    feedbackCategories,
    feedbackRatings,
    symptomsByPhase,
  ] = await Promise.all([
    getCycleLengthDistribution({ from: new Date(0), to: dayEnd }),
    getSymptomsByCategory(),
    getPredictionAccuracy(),
    getUserRetention({ from: new Date(dayEnd.getTime() - 8 * 7 * DAY_MS), to: dayEnd }),
    getUserTrend(days),
    getPredictionMae(),
    getFeedbackVolume(days),
    getFeedbackCategories(days),
    getFeedbackRatings(days),
    getSymptomsByPhase({ from: new Date(dayEnd.getTime() - 90 * DAY_MS), to: dayEnd }),
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
      feedbackVolume={feedbackVolume}
      feedbackCategories={feedbackCategories}
      feedbackRatings={feedbackRatings}
      symptomsByPhase={symptomsByPhase}
    />
  )
}
