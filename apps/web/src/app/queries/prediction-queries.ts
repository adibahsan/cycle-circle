import { cache } from 'react'
import { requireCurrentUser } from './auth-queries'
import { getProfileById } from '@vesta/shared/server/services'

const TIER_EXPLANATIONS: Record<string, string> = {
  AVERAGE: 'Tier 1: Based on average cycle length',
  ARIMA: 'Tier 2: ARIMA model with 6+ cycles',
  LSTM: 'Tier 3: LSTM deep learning model with 12+ cycles',
}

export const getPrediction = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  let result: Awaited<ReturnType<typeof getProfileById>> | null = null
  try {
    result = await getProfileById(profileId, user.id)
  } catch {
    return null
  }

  const { prediction } = result
  const tierExplanation = prediction
    ? (TIER_EXPLANATIONS[prediction.tier] ?? 'Tier 1: Based on average cycle length')
    : null

  return { prediction, tierExplanation }
})
