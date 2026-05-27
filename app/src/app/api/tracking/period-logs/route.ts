import { z } from 'zod'
import { withAuth } from '@/server/middleware'
import { handleApiError, ApiError } from '@/server/api-error'
import { parseBody, parseSearchParams } from '@/server/validation'
import { prisma } from '@/server/db'
import { enqueueJob } from '@/server/adapters/jobs'
import { ensurePeriodLogFromProfile } from '@/server/period-log-sync'
import type { AuthUser } from '@/server/auth'

const getParamsSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
})

const createLogSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']),
})

async function verifyProfileOwnership(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) {
    throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
  }
  return profile
}

export const GET = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const params = await parseSearchParams(request, getParamsSchema)
    const profile = await verifyProfileOwnership(params.profileId, user.id)
    await ensurePeriodLogFromProfile(profile)

    const logs = await prisma.periodLog.findMany({
      where: { profileId: params.profileId },
      orderBy: { startDate: 'desc' },
    })

    return Response.json({ logs })
  } catch (error) {
    return handleApiError(error)
  }
})

export const POST = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const body = await parseBody(request, createLogSchema)
    await verifyProfileOwnership(body.profileId, user.id)

    const log = await prisma.periodLog.create({
      data: {
        profileId: body.profileId,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        flowIntensity: body.flowIntensity,
      },
    })

    await enqueueJob('PREDICTION_RECALC', { profileId: body.profileId })

    return Response.json({ log }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
})
