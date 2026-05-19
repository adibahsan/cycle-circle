import { z } from 'zod'
import { withAuth } from '@/lib/server/middleware'
import { handleApiError, ApiError } from '@/lib/server/api-error'
import { parseBody } from '@/lib/server/validation'
import { prisma } from '@/lib/server/db'
import { enqueueJob } from '@/lib/server/adapters/jobs'
import type { AuthUser } from '@/lib/server/auth'

type RouteContext = { params: Promise<Record<string, string>>; user: AuthUser }

async function getOwnedLog(logId: string, userId: string) {
  const log = await prisma.periodLog.findUnique({
    where: { id: logId },
    include: { profile: true },
  })
  if (!log || log.profile.userId !== userId) {
    throw new ApiError(404, 'Period log not found', 'LOG_NOT_FOUND')
  }
  return log
}

const patchSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']).optional(),
})

export const PATCH = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    const log = await getOwnedLog(id, user.id)

    const body = await parseBody(request, patchSchema)

    const updated = await prisma.periodLog.update({
      where: { id },
      data: {
        ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
        ...(body.endDate !== undefined && { endDate: new Date(body.endDate) }),
        ...(body.flowIntensity !== undefined && { flowIntensity: body.flowIntensity }),
      },
    })

    await enqueueJob('PREDICTION_RECALC', { profileId: log.profileId })

    return Response.json({ log: updated })
  } catch (error) {
    return handleApiError(error)
  }
})

export const DELETE = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    const log = await getOwnedLog(id, user.id)

    await prisma.periodLog.delete({ where: { id } })
    await enqueueJob('PREDICTION_RECALC', { profileId: log.profileId })

    return Response.json({ message: 'Period log deleted' })
  } catch (error) {
    return handleApiError(error)
  }
})
