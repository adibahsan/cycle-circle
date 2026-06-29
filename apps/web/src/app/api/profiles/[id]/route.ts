import { z } from 'zod'
import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { parseBody } from '@vesta/shared/server/validation'
import { getProfileById, updateProfile, removeProfile } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'

type RouteContext = { params: Promise<Record<string, string>>; user: AuthUser }

export const GET = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    const { profile, prediction } = await getProfileById(id, user.id)
    return Response.json({ profile, prediction })
  } catch (error) {
    return handleApiError(error)
  }
})

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cycleLength: z.number().int().min(21).max(45).optional(),
  periodLength: z.number().int().min(1).max(14).optional(),
  goal: z.string().max(500).nullable().optional(),
})

export const PATCH = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    const body = await parseBody(request, patchSchema)

    const updated = await updateProfile(id, user.id, {
      name: body.name,
      cycleLength: body.cycleLength,
      periodLength: body.periodLength,
      goal: body.goal,
    })

    revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
    revalidateTag(cacheTags.tracking(id), { expire: 0 })

    return Response.json({ profile: updated })
  } catch (error) {
    return handleApiError(error)
  }
})

export const DELETE = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    await removeProfile(id, user.id)

    revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
    revalidateTag(cacheTags.tracking(id), { expire: 0 })

    return Response.json({ message: 'Profile deleted' })
  } catch (error) {
    return handleApiError(error)
  }
})
