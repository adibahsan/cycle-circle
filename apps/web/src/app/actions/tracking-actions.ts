'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@vesta/shared'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import { enqueueJob } from '@vesta/shared/server/adapters/jobs'

async function verifyProfileOwnership(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) throw new Error('Profile not found')
  return profile
}

const createPeriodLogSchema = z.object({
  profileId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']),
})

export async function createPeriodLog(input: z.infer<typeof createPeriodLogSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = createPeriodLogSchema.parse(input)

  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  if (end < start) throw new Error('End date must be on or after start date')

  await verifyProfileOwnership(data.profileId, user.id)

  const log = await prisma.periodLog.create({
    data: {
      profileId: data.profileId,
      startDate: start,
      endDate: end,
      flowIntensity: data.flowIntensity,
    },
  })

  await enqueueJob('PREDICTION_RECALC', { profileId: data.profileId })
  revalidatePath('/')
  return log
}

const updatePeriodLogSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']).optional(),
})

export async function updatePeriodLog(logId: string, input: z.infer<typeof updatePeriodLogSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = updatePeriodLogSchema.parse(input)

  const log = await prisma.periodLog.findUnique({
    where: { id: logId },
    include: { profile: true },
  })
  if (!log || log.profile.userId !== user.id) throw new Error('Period log not found')

  const updated = await prisma.periodLog.update({
    where: { id: logId },
    data: {
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
      ...(data.flowIntensity !== undefined && { flowIntensity: data.flowIntensity }),
    },
  })

  await enqueueJob('PREDICTION_RECALC', { profileId: log.profileId })
  revalidatePath('/')
  return updated
}

export async function deletePeriodLog(logId: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  const log = await prisma.periodLog.findUnique({
    where: { id: logId },
    include: { profile: true },
  })
  if (!log || log.profile.userId !== user.id) throw new Error('Period log not found')

  await prisma.periodLog.delete({ where: { id: logId } })
  await enqueueJob('PREDICTION_RECALC', { profileId: log.profileId })
  revalidatePath('/')
}

const createSymptomSchema = z.object({
  profileId: z.string().min(1),
  date: z.string().min(1),
  category: z.enum(['PHYSICAL', 'MOOD', 'DISCHARGE', 'LIFESTYLE']),
  symptomId: z.string().min(1),
  value: z.string().min(1),
})

export async function toggleSymptom(input: z.infer<typeof createSymptomSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = createSymptomSchema.parse(input)

  await verifyProfileOwnership(data.profileId, user.id)

  const existing = await prisma.symptomLog.findFirst({
    where: {
      profileId: data.profileId,
      symptomId: data.symptomId,
      date: new Date(data.date),
    },
  })

  if (existing) {
    await prisma.symptomLog.delete({ where: { id: existing.id } })
  } else {
    await prisma.symptomLog.create({
      data: {
        profileId: data.profileId,
        date: new Date(data.date),
        category: data.category,
        symptomId: data.symptomId,
        value: data.value,
      },
    })
  }

  revalidatePath('/')
}
