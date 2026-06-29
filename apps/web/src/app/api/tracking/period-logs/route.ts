import { z } from 'zod'
import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { parseBody, parseSearchParams } from '@vesta/shared/server/validation'
import { listPeriodLogs, createPeriodLog, recalculatePrediction } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'

const getParamsSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
})

const createLogSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']),
})

export const GET = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const params = await parseSearchParams(request, getParamsSchema)
    const logs = await listPeriodLogs(params.profileId, user.id)
    return Response.json({ logs })
  } catch (error) {
    return handleApiError(error)
  }
})

export const POST = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const body = await parseBody(request, createLogSchema)
    const { log } = await createPeriodLog(body.profileId, user.id, {
      startDate: body.startDate,
      endDate: body.endDate,
      flowIntensity: body.flowIntensity,
    })

    await recalculatePrediction(body.profileId)
    revalidateTag(cacheTags.tracking(body.profileId), { expire: 0 })

    return Response.json({ log }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
})
