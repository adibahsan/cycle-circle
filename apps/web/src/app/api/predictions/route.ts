import { withAuth } from '@/server/middleware'
import { handleApiError, ApiError } from '@/server/api-error'
import { parseSearchParams } from '@/server/validation'
import { prisma } from '@/server/db'
import { z } from 'zod'
import type { AuthUser } from '@/server/auth'

const paramsSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
})

const TIER_EXPLANATIONS: Record<string, string> = {
  AVERAGE: 'Tier 1: Based on average cycle length',
  ARIMA: 'Tier 2: ARIMA model with 6+ cycles',
  LSTM: 'Tier 3: LSTM deep learning model with 12+ cycles',
}

export const GET = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const params = await parseSearchParams(request, paramsSchema)

    const profile = await prisma.profile.findUnique({ where: { id: params.profileId } })
    if (!profile || profile.userId !== user.id) {
      throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
    }

    const prediction = await prisma.prediction.findUnique({
      where: { profileId: profile.id },
    })

    const tierExplanation = prediction
      ? (TIER_EXPLANATIONS[prediction.tier] ?? 'Tier 1: Based on average cycle length')
      : null

    return Response.json({ prediction, tierExplanation })
  } catch (error) {
    return handleApiError(error)
  }
})
