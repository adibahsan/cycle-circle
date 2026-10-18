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
import {
  ACCURACY_METRICS,
  TREND_METRICS,
  resolveMetric,
  resolvePanelRange,
} from '@/lib/analytics-panels'
import { AnalyticsClient } from './AnalyticsClient'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()

  const params = await searchParams
  const now = new Date()
  const cycleLength = resolvePanelRange(params, 'cycleLength', now)
  const symptoms = resolvePanelRange(params, 'symptoms', now)
  const phase = resolvePanelRange(params, 'phase', now)
  const accuracy = resolvePanelRange(params, 'accuracy', now)
  const mae = resolvePanelRange(params, 'mae', now)
  const retention = resolvePanelRange(params, 'retention', now)
  const trend = resolvePanelRange(params, 'trend', now)
  const feedback = resolvePanelRange(params, 'feedback', now)
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
    getCycleLengthDistribution(cycleLength.range),
    getSymptomsByCategory(symptoms.range),
    getPredictionAccuracy(accuracy.range),
    getUserRetention(retention.range),
    getTrendMetric(trendMetric, trend.days),
    getPredictionMae(),
    getPredictionMaeTrend(mae.range),
    getFeedbackVolume(feedback.days),
    getFeedbackCategories(feedback.days),
    getFeedbackRatings(feedback.days),
    getSymptomsByPhase(phase.range),
  ])

  return (
    <AnalyticsClient
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
