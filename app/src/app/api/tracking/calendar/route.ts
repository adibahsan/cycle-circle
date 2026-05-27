import { withAuth } from '@/server/middleware'
import { handleApiError, ApiError } from '@/server/api-error'
import { parseSearchParams } from '@/server/validation'
import { prisma } from '@/server/db'
import { addPeriodDatesInRange, ensurePeriodLogFromProfile } from '@/server/period-log-sync'
import { z } from 'zod'
import type { AuthUser } from '@/server/auth'

const paramsSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format'),
})

interface CalendarDay {
  date: string
  period: boolean
  fertile: boolean
  ovulation: boolean
  predicted: boolean
}

export const GET = withAuth(async (request, { user }: { user: AuthUser }) => {
  try {
    const params = await parseSearchParams(request, paramsSchema)

    const profile = await prisma.profile.findUnique({ where: { id: params.profileId } })
    if (!profile || profile.userId !== user.id) {
      throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
    }

    const [year, month] = params.month.split('-').map(Number)
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0) // last day of month

    await ensurePeriodLogFromProfile(profile)

    // Fetch actual period logs that overlap with this month
    const periodLogs = await prisma.periodLog.findMany({
      where: {
        profileId: profile.id,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    })

    const prediction = await prisma.prediction.findUnique({
      where: { profileId: profile.id },
    })

    // Build sets of dates for fast lookup
    const periodDates = new Set<string>()
    const predictedDates = new Set<string>()
    const fertileDates = new Set<string>()
    let ovulationDateStr: string | null = null

    // Mark actual period log days
    for (const log of periodLogs) {
      addPeriodDatesInRange(
        new Date(log.startDate),
        new Date(log.endDate),
        monthStart,
        monthEnd,
        periodDates,
      )
    }

    // Mark predicted future period days
    if (prediction?.nextPeriodStart) {
      const predStart = new Date(prediction.nextPeriodStart)
      predStart.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Only mark future predictions
      if (predStart > today) {
        const predEnd = new Date(predStart)
        predEnd.setDate(predEnd.getDate() + profile.periodLength - 1)

        const cur = new Date(predStart)
        while (cur <= predEnd) {
          if (cur >= monthStart && cur <= monthEnd) {
            predictedDates.add(cur.toISOString().slice(0, 10))
          }
          cur.setDate(cur.getDate() + 1)
        }
      }
    }

    // Mark ovulation and fertile window
    if (prediction?.ovulationDay) {
      const ovDate = new Date(prediction.ovulationDay)
      ovDate.setHours(0, 0, 0, 0)

      if (ovDate >= monthStart && ovDate <= monthEnd) {
        ovulationDateStr = ovDate.toISOString().slice(0, 10)
      }

      // Fertile window: 5 days before ovulation + ovulation day
      for (let offset = -5; offset <= 0; offset++) {
        const fertileDate = new Date(ovDate)
        fertileDate.setDate(fertileDate.getDate() + offset)
        if (fertileDate >= monthStart && fertileDate <= monthEnd) {
          fertileDates.add(fertileDate.toISOString().slice(0, 10))
        }
      }
    } else if (prediction?.fertileStart && prediction?.fertileEnd) {
      // Use fertileStart/fertileEnd from prediction record
      const fStart = new Date(prediction.fertileStart)
      const fEnd = new Date(prediction.fertileEnd)
      fStart.setHours(0, 0, 0, 0)
      fEnd.setHours(0, 0, 0, 0)

      const cur = new Date(fStart)
      while (cur <= fEnd) {
        if (cur >= monthStart && cur <= monthEnd) {
          fertileDates.add(cur.toISOString().slice(0, 10))
        }
        cur.setDate(cur.getDate() + 1)
      }
    }

    // Build calendar array
    const days: CalendarDay[] = []
    const cur = new Date(monthStart)
    while (cur <= monthEnd) {
      const dateStr = cur.toISOString().slice(0, 10)
      days.push({
        date: dateStr,
        period: periodDates.has(dateStr),
        fertile: fertileDates.has(dateStr),
        ovulation: dateStr === ovulationDateStr,
        predicted: predictedDates.has(dateStr),
      })
      cur.setDate(cur.getDate() + 1)
    }

    return Response.json({ days })
  } catch (error) {
    return handleApiError(error)
  }
})
