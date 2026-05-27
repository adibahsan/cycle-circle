import { withAuth } from '@/server/middleware'
import { handleApiError, ApiError } from '@/server/api-error'
import { parseSearchParams } from '@/server/validation'
import { prisma } from '@/server/db'
import { getLatestPeriodLog } from '@/server/period-log-sync'
import { z } from 'zod'
import type { AuthUser } from '@/server/auth'

const paramsSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
})

type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

function calculatePhase(
  currentCycleDay: number,
  periodLength: number,
  cycleLength: number,
  ovulationDay: number,
): CyclePhase {
  if (currentCycleDay <= periodLength) return 'menstrual'
  if (currentCycleDay >= ovulationDay - 1 && currentCycleDay <= ovulationDay + 1) return 'ovulatory'
  if (currentCycleDay < ovulationDay - 1) return 'follicular'
  return 'luteal'
}

export const GET = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const params = await parseSearchParams(request, paramsSchema)

    const profile = await prisma.profile.findUnique({ where: { id: params.profileId } })
    if (!profile || profile.userId !== user.id) {
      throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
    }

    const lastPeriod = await getLatestPeriodLog(profile)

    const prediction = await prisma.prediction.findUnique({
      where: { profileId: profile.id },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let currentCycleDay = 1
    let currentPhase: CyclePhase = 'follicular'
    let countdownToNextPeriod: number | null = null

    const estimatedOvulationDayInCycle = profile.cycleLength - 14

    if (lastPeriod) {
      const lastStart = new Date(lastPeriod.startDate)
      lastStart.setHours(0, 0, 0, 0)
      const diffMs = today.getTime() - lastStart.getTime()
      currentCycleDay = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)

      let ovulationDayInCycle = estimatedOvulationDayInCycle
      if (prediction?.ovulationDay) {
        const ovDate = new Date(prediction.ovulationDay)
        ovDate.setHours(0, 0, 0, 0)
        ovulationDayInCycle = Math.floor(
          (ovDate.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1
      }

      currentPhase = calculatePhase(
        currentCycleDay,
        profile.periodLength,
        profile.cycleLength,
        ovulationDayInCycle,
      )
    }

    if (prediction?.nextPeriodStart) {
      const nextStart = new Date(prediction.nextPeriodStart)
      nextStart.setHours(0, 0, 0, 0)
      countdownToNextPeriod = Math.max(
        0,
        Math.ceil((nextStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      )
    } else if (lastPeriod) {
      const lastStart = new Date(lastPeriod.startDate)
      lastStart.setHours(0, 0, 0, 0)
      const nextEstimated = new Date(lastStart)
      nextEstimated.setDate(nextEstimated.getDate() + profile.cycleLength)
      countdownToNextPeriod = Math.max(
        0,
        Math.ceil((nextEstimated.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      )
    }

    const lastPeriodSummary = lastPeriod
      ? {
          startDate: lastPeriod.startDate,
          duration:
            Math.floor(
              (new Date(lastPeriod.endDate).getTime() - new Date(lastPeriod.startDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1,
          flowIntensity: lastPeriod.flowIntensity,
        }
      : null

    return Response.json({
      currentCycleDay,
      currentPhase,
      countdownToNextPeriod,
      lastPeriod: lastPeriodSummary,
      prediction,
    })
  } catch (error) {
    return handleApiError(error)
  }
})
