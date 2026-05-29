import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireCurrentUser } from './auth-queries'

export const getSymptomLogs = cache(async (profileId: string, date?: string) => {
  const user = await requireCurrentUser()
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== user.id) return []

  const where: Record<string, unknown> = { profileId }
  if (date) {
    const day = new Date(date)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    where.date = { gte: day, lt: nextDay }
  }

  return prisma.symptomLog.findMany({
    where,
    orderBy: { date: 'desc' },
  })
})
