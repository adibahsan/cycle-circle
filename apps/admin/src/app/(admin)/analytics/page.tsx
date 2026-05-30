import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getCycleLengthDistribution,
  getSymptomsByCategory,
  getPredictionAccuracy,
  getUserRetention,
} from '@/app/queries/analytics-queries'
import { AnalyticsClient } from './AnalyticsClient'

export default async function AnalyticsPage() {
  await requireAdminUser()
  const [cycleLengths, symptoms, predictions, retention] = await Promise.all([
    getCycleLengthDistribution(),
    getSymptomsByCategory(),
    getPredictionAccuracy(),
    getUserRetention(),
  ])
  return (
    <AnalyticsClient
      cycleLengths={cycleLengths}
      symptoms={symptoms}
      predictions={predictions}
      retention={retention}
    />
  )
}
