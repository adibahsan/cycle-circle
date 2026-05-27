import { z } from 'zod'
import { withAuth } from '@/server/middleware'
import { handleApiError, ApiError } from '@/server/api-error'
import { parseBody } from '@/server/validation'
import { prisma } from '@/server/db'
import { enqueueJob } from '@/server/adapters/jobs'
import { ensurePeriodLogFromProfile } from '@/server/period-log-sync'
import type { AuthUser } from '@/server/auth'

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
    const profiles = await prisma.profile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    return Response.json({ profiles })
  } catch (error) {
    return handleApiError(error)
  }
})

export const POST = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const body = await parseBody(request, createProfileSchema)

    const count = await prisma.profile.count({ where: { userId: user.id } })
    if (count >= 6) {
      throw new ApiError(400, 'Maximum of 6 profiles allowed', 'PROFILE_LIMIT_REACHED')
    }

    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        name: body.name,
        relation: body.relation,
        cycleLength: body.cycleLength ?? 28,
        periodLength: body.periodLength ?? 5,
        lastPeriodStart: body.lastPeriodStart ? new Date(body.lastPeriodStart) : undefined,
        goal: body.goal,
      },
    })

    await prisma.notificationPreference.create({
      data: {
        profileId: profile.id,
        periodAlert: true,
        fertileWindow: true,
        loggingReminder: true,
      },
    })

    if (body.lastPeriodStart) {
      await ensurePeriodLogFromProfile(profile)
    }

    return Response.json({ profile }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
})
