import { z } from 'zod'
import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { parseBody, parseSearchParams } from '@vesta/shared/server/validation'
import { getSymptomLogs, toggleSymptomLog } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'

const getParamsSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  date: z.string().optional(),
})

const createSymptomSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  date: z.string().min(1, 'date is required'),
  category: z.enum(['PHYSICAL', 'MOOD', 'DISCHARGE', 'LIFESTYLE']),
  symptomId: z.string().min(1, 'symptomId is required'),
  value: z.string().min(1, 'value is required'),
})

export const GET = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const params = await parseSearchParams(request, getParamsSchema)
    const logs = await getSymptomLogs(params.profileId, user.id, params.date)
    return Response.json({ logs })
  } catch (error) {
    return handleApiError(error)
  }
})

export const POST = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const body = await parseBody(request, createSymptomSchema)
    const result = await toggleSymptomLog(body.profileId, user.id, {
      date: body.date,
      category: body.category,
      symptomId: body.symptomId,
      value: body.value,
    })

    if (result.action === 'created') {
      return Response.json({ log: result.log }, { status: 201 })
    }
    return Response.json({ message: 'Symptom log toggled' })
  } catch (error) {
    return handleApiError(error)
  }
})
