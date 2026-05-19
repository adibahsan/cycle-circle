import { z } from 'zod'
import { withAuth } from '@/lib/server/middleware'
import { handleApiError, ApiError } from '@/lib/server/api-error'
import { parseBody } from '@/lib/server/validation'
import { prisma } from '@/lib/server/db'
import type { AuthUser } from '@/lib/server/auth'

type RouteContext = { params: Promise<Record<string, string>>; user: AuthUser }

async function getOwnedProfile(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) {
    throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
  }
  return profile
}

export const GET = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    const profile = await getOwnedProfile(id, user.id)

    const prediction = await prisma.prediction.findUnique({
      where: { profileId: profile.id },
    })

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
    await getOwnedProfile(id, user.id)

    const body = await parseBody(request, patchSchema)

    const updated = await prisma.profile.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.cycleLength !== undefined && { cycleLength: body.cycleLength }),
        ...(body.periodLength !== undefined && { periodLength: body.periodLength }),
        ...(body.goal !== undefined && { goal: body.goal }),
      },
    })

    return Response.json({ profile: updated })
  } catch (error) {
    return handleApiError(error)
  }
})

export const DELETE = withAuth(async (request, { params, user }: RouteContext) => {
  try {
    const { id } = await params
    await getOwnedProfile(id, user.id)

    const totalProfiles = await prisma.profile.count({ where: { userId: user.id } })
    if (totalProfiles <= 1) {
      throw new ApiError(400, 'Cannot delete your last profile', 'LAST_PROFILE')
    }

    await prisma.profile.delete({ where: { id } })

    return Response.json({ message: 'Profile deleted' })
  } catch (error) {
    return handleApiError(error)
  }
})
