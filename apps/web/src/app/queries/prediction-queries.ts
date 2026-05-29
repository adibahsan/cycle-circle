import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireCurrentUser } from './auth-queries'

const TIER_EXPLANATIONS: Record<string, string> = {
  AVERAGE: 'Tier 1: Based on average cycle length',
  ARIMA: 'Tier 2: ARIMA model with 6+ cycles',
  LSTM: 'Tier 3: LSTM deep learning model with 12+ cycles',
}

export const getPrediction = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== user.id) return null

  const prediction = await prisma.prediction.findUnique({ where: { profileId: profile.id } })
  const tierExplanation = prediction
    ? (TIER_EXPLANATIONS[prediction.tier] ?? 'Tier 1: Based on average cycle length')
    : null

  return { prediction, tierExplanation }
})
