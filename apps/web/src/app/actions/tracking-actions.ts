'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createPeriodLog as svcCreatePeriodLog,
  updatePeriodLog as svcUpdatePeriodLog,
  deletePeriodLog as svcDeletePeriodLog,
  toggleSymptomLog,
  setAllGoodToday,
  recalculatePrediction,
} from '@vesta/shared/server/services'

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

  const { log, shouldRecalcPrediction } = await svcCreatePeriodLog(data.profileId, user.id, {
    startDate: data.startDate,
    endDate: data.endDate,
    flowIntensity: data.flowIntensity,
  })

  if (shouldRecalcPrediction) {
    await recalculatePrediction(data.profileId)
  }
  revalidateTag(`tracking:${data.profileId}`, { expire: 0 })
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

  const { log, profileId, shouldRecalcPrediction } = await svcUpdatePeriodLog(logId, user.id, data)

  if (shouldRecalcPrediction) {
    await recalculatePrediction(profileId)
  }
  revalidateTag(`tracking:${profileId}`, { expire: 0 })
  return log
}

export async function deletePeriodLog(logId: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  const { profileId, shouldRecalcPrediction } = await svcDeletePeriodLog(logId, user.id)

  if (shouldRecalcPrediction) {
    await recalculatePrediction(profileId)
  }
  revalidateTag(`tracking:${profileId}`, { expire: 0 })
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

  await toggleSymptomLog(data.profileId, user.id, {
    date: data.date,
    category: data.category,
    symptomId: data.symptomId,
    value: data.value,
  })

  revalidateTag(`symptoms:${data.profileId}`, { expire: 0 })
  revalidateTag(`tracking:${data.profileId}`, { expire: 0 })
}

const allGoodSchema = z.object({
  profileId: z.string().min(1),
  date: z.string().optional(),
})

export async function markAllGoodToday(profileId: string, date?: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = allGoodSchema.parse({ profileId, date })

  await setAllGoodToday(data.profileId, user.id, data.date)

  revalidateTag(`symptoms:${data.profileId}`, { expire: 0 })
  revalidateTag(`tracking:${data.profileId}`, { expire: 0 })
}
