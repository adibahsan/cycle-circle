import { z } from 'zod'
import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { parseBody } from '@vesta/shared/server/validation'
import { updatePeriodLog, deletePeriodLog, recalculatePrediction } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'

type RouteContext = { params: Promise<Record<string, string>>; user: AuthUser }

const patchSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']).optional(),
})

export const PATCH = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    const body = await parseBody(request, patchSchema)

    const { log, profileId } = await updatePeriodLog(id, user.id, {
      startDate: body.startDate,
      endDate: body.endDate,
      flowIntensity: body.flowIntensity,
    })

    await recalculatePrediction(profileId)
    revalidateTag(cacheTags.tracking(profileId), { expire: 0 })

    return Response.json({ log })
  } catch (error) {
    return handleApiError(error)
  }
})

export const DELETE = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    const { profileId } = await deletePeriodLog(id, user.id)

    await recalculatePrediction(profileId)
    revalidateTag(cacheTags.tracking(profileId), { expire: 0 })

    return Response.json({ message: 'Period log deleted' })
  } catch (error) {
    return handleApiError(error)
  }
})
