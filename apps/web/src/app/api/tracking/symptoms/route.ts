import { z } from 'zod'
import { withAuth } from '@/server/middleware'
import { handleApiError, ApiError } from '@/server/api-error'
import { parseBody, parseSearchParams } from '@/server/validation'
import { prisma } from '@/server/db'
import type { AuthUser } from '@/server/auth'

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
    await verifyProfileOwnership(params.profileId, user.id)

    const where: Record<string, unknown> = { profileId: params.profileId }
    if (params.date) {
      const day = new Date(params.date)
      const nextDay = new Date(day)
      nextDay.setDate(nextDay.getDate() + 1)
      where.date = { gte: day, lt: nextDay }
    }

    const logs = await prisma.symptomLog.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    return Response.json({ logs })
  } catch (error) {
    return handleApiError(error)
  }
})

export const POST = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const body = await parseBody(request, createSymptomSchema)
    await verifyProfileOwnership(body.profileId, user.id)

    const log = await prisma.symptomLog.create({
      data: {
        profileId: body.profileId,
        date: new Date(body.date),
        category: body.category,
        symptomId: body.symptomId,
        value: body.value,
      },
    })

    return Response.json({ log }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
})
