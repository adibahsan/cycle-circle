import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getCycleLengthDistribution,
  getSymptomsByCategory,
  getPredictionAccuracy,
  getUserRetention,
  getTrendMetric,
  getPredictionMae,
  getPredictionMaeTrend,
  getSymptomsByPhase,
} from '@/app/queries/analytics-queries'
import {
  getFeedbackVolume,
  getFeedbackCategories,
  getFeedbackRatings,
} from '@/app/queries/feedback-queries'
import { ACCURACY_METRICS, TREND_METRICS, resolveMetric } from '@/lib/analytics-panels'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import { AnalyticsClient } from './AnalyticsClient'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()

  const params = await searchParams
  const now = new Date()
  const range = parseDateRange(params, now)
  const accuracyMetric = resolveMetric(params, ACCURACY_METRICS)
  const trendMetric = resolveMetric(params, TREND_METRICS)

  const [
    cycleLengths,
    symptomsData,
    predictions,
    retentionData,
    trendData,
    predictionMae,
    predictionMaeTrend,
    feedbackVolume,
    feedbackCategories,
    feedbackRatings,
    symptomsByPhase,
  ] = await Promise.all([
    getCycleLengthDistribution(range),
    getSymptomsByCategory(range),
    getPredictionAccuracy(range),
    getUserRetention(range),
    getTrendMetric(trendMetric, range),
    getPredictionMae(),
    getPredictionMaeTrend(range),
    getFeedbackVolume(range),
    getFeedbackCategories(range),
    getFeedbackRatings(range),
    getSymptomsByPhase(range),
  ])

  return (
    <AnalyticsClient
      range={range}
      cycleLengths={cycleLengths}
      symptoms={symptomsData}
      predictions={predictions}
      accuracyMetric={accuracyMetric}
      retention={retentionData}
      trend={trendData}
      trendMetric={trendMetric}
      predictionMae={predictionMae}
      predictionMaeTrend={predictionMaeTrend}
      feedbackVolume={feedbackVolume}
      feedbackCategories={feedbackCategories}
      feedbackRatings={feedbackRatings}
      symptomsByPhase={symptomsByPhase}
    />
  )
}
