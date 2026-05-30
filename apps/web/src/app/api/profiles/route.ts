import { z } from 'zod'
import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { parseBody } from '@vesta/shared/server/validation'
import { listProfiles, createProfile } from '@vesta/shared/server/services'
import { enqueueJob } from '@vesta/shared/server/adapters/jobs'
import type { AuthUser } from '@vesta/shared/server/auth'

const createProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  relation: z.enum(['SELF', 'WIFE', 'SISTER', 'MOTHER', 'DAUGHTER', 'GIRLFRIEND']),
  cycleLength: z.number().int().min(21).max(45).optional(),
  periodLength: z.number().int().min(1).max(14).optional(),
  lastPeriodStart: z.string().optional(),
  goal: z.string().max(500).optional(),
})

export const GET = withAuth(async (_request, { user }: { user: AuthUser }) => {
  try {
    const profiles = await listProfiles(user.id)
    return Response.json({ profiles })
  } catch (error) {
    return handleApiError(error)
  }
})

export const POST = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const body = await parseBody(request, createProfileSchema)

    const profile = await createProfile(user.id, {
      name: body.name,
      relation: body.relation,
      cycleLength: body.cycleLength,
      periodLength: body.periodLength,
      lastPeriodStart: body.lastPeriodStart,
      goal: body.goal,
    })

    return Response.json({ profile }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
})
